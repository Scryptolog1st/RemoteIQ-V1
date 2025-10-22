import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { PgPoolService } from "../storage/pg-pool.service";

const PASSWORD_MIN_LEN = parseInt(process.env.PASSWORD_MIN_LEN || "8", 10) || 8;
const TOTP_ISSUER = process.env.TOTP_ISSUER || "RemoteIQ";
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_ATTEMPTS = 5;
/** drift window in 30s steps (otplib window is +/- this value) */
const TOTP_WINDOW = parseInt(process.env.TOTP_WINDOW || "1", 10) || 1;

type SessionRow = {
    id: string;
    user_id: string;
    jti: string | null;
    user_agent: string | null;
    ip: string | null;
    created_at: string;
    last_seen_at: string;
    revoked_at: string | null;
    trusted: boolean | null;
};

type TokenRow = {
    id: string;
    user_id: string;
    name: string;
    token_hash: string;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
};

const rateMap = new Map<string, number[]>();
function checkRate(key: string) {
    const now = Date.now();
    const arr = (rateMap.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (arr.length >= RATE_MAX_ATTEMPTS) {
        throw new HttpException("Too many attempts, slow down.", HttpStatus.TOO_MANY_REQUESTS);
    }
    arr.push(now);
    rateMap.set(key, arr);
}

@Injectable()
export class SecurityService {
    constructor(@Inject(PgPoolService) private readonly pg: PgPoolService) {
        authenticator.options = { window: TOTP_WINDOW };
    }

    /* ------------------------- Password ------------------------- */
    async changePassword(userId: string, current: string, next: string) {
        checkRate(`pw:${userId}`);
        if (!next || next.length < PASSWORD_MIN_LEN) {
            throw new HttpException(
                `Password must be at least ${PASSWORD_MIN_LEN} characters.`,
                HttpStatus.BAD_REQUEST,
            );
        }
        if (current === next) {
            throw new HttpException("New password must differ from current.", HttpStatus.BAD_REQUEST);
        }

        const { rows } = await this.pg.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
        if (rows.length === 0) throw new HttpException("User not found.", HttpStatus.NOT_FOUND);

        const ok = await bcrypt.compare(current, (rows[0] as any).password_hash);
        if (!ok) throw new HttpException("Current password is incorrect.", HttpStatus.FORBIDDEN);

        const newHash = await bcrypt.hash(next, 12);
        await this.pg.query(
            "UPDATE users SET password_hash = $1, password_updated_at = now() WHERE id = $2",
            [newHash, userId],
        );
        return true;
    }

    /* ------------------------- 2FA (TOTP) ------------------------- */

    /** Step 1: generate a secret (do NOT enable yet), return otpauth URL + QR */
    async start2fa(userId: string, email: string) {
        checkRate(`2fa:start:${userId}`);

        const secret = authenticator.generateSecret(); // base32
        const label = encodeURIComponent(email);
        const issuer = encodeURIComponent(TOTP_ISSUER);
        const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
        const qrPngDataUrl = await QRCode.toDataURL(otpauthUrl);

        // IMPORTANT: write to two_factor_secret (NOT totp_secret), keep disabled until confirm
        await this.pg.query(
            `UPDATE users
          SET two_factor_secret = $1,
              two_factor_enabled = false,
              two_factor_recovery_codes = COALESCE(two_factor_recovery_codes, '{}'::text[])
        WHERE id = $2`,
            [secret, userId],
        );

        return { secret, otpauthUrl, qrPngDataUrl };
    }

    /** Step 2: confirm one valid TOTP; then enable and create recovery codes */
    async confirm2fa(userId: string, code: string) {
        checkRate(`2fa:confirm:${userId}`);

        const { rows } = await this.pg.query(
            "SELECT two_factor_secret FROM users WHERE id = $1",
            [userId],
        );
        if (rows.length === 0) throw new HttpException("User not found.", HttpStatus.NOT_FOUND);

        const secret = (rows[0] as any).two_factor_secret as string | null;
        if (!secret) throw new HttpException("Start 2FA first.", HttpStatus.BAD_REQUEST);

        const token = (code || "").replace(/\D/g, "").slice(-6);
        if (token.length !== 6) {
            throw new HttpException("Invalid TOTP code.", HttpStatus.BAD_REQUEST);
        }

        const valid = authenticator.verify({ token, secret });
        if (!valid) throw new HttpException("Invalid TOTP code.", HttpStatus.BAD_REQUEST);

        const recoveryCodes = this.generateRecoveryCodes(8); // plaintext; FE should show/save

        await this.pg.query(
            `UPDATE users
          SET two_factor_enabled = true,
              two_factor_recovery_codes = $1
        WHERE id = $2`,
            [recoveryCodes, userId],
        );

        return recoveryCodes;
    }

    /** Disable using either a current TOTP or a recovery code (consumes it) */
    async disable2fa(userId: string, code?: string, recoveryCode?: string) {
        checkRate(`2fa:disable:${userId}`);

        const { rows } = await this.pg.query(
            "SELECT two_factor_secret, two_factor_recovery_codes, two_factor_enabled FROM users WHERE id = $1",
            [userId],
        );
        if (rows.length === 0) throw new HttpException("User not found.", HttpStatus.NOT_FOUND);

        const row = rows[0] as any;
        if (!row.two_factor_enabled) {
            // idempotent clear
            await this.pg.query(
                `UPDATE users
            SET two_factor_enabled = false,
                two_factor_secret = NULL,
                two_factor_recovery_codes = '{}'::text[]
          WHERE id = $1`,
                [userId],
            );
            return;
        }

        let ok = false;
        if (!ok && code && row.two_factor_secret) {
            const token = String(code).replace(/\D/g, "").slice(-6);
            if (token.length === 6) ok = authenticator.verify({ token, secret: row.two_factor_secret });
        }

        if (!ok && recoveryCode) {
            const list: string[] = row.two_factor_recovery_codes || [];
            const idx = list.findIndex((c) => c === recoveryCode);
            if (idx >= 0) {
                ok = true;
                list.splice(idx, 1); // consume
                await this.pg.query(
                    "UPDATE users SET two_factor_recovery_codes = $1 WHERE id = $2",
                    [list, userId],
                );
            }
        }

        if (!ok) throw new HttpException("Invalid code or recovery code.", HttpStatus.FORBIDDEN);

        await this.pg.query(
            `UPDATE users
          SET two_factor_enabled = false,
              two_factor_secret = NULL,
              two_factor_recovery_codes = '{}'::text[]
        WHERE id = $1`,
            [userId],
        );
    }

    async regenerateRecoveryCodes(userId: string) {
        checkRate(`2fa:regen:${userId}`);

        const { rows } = await this.pg.query(
            "SELECT two_factor_enabled FROM users WHERE id = $1",
            [userId],
        );
        if (rows.length === 0) throw new HttpException("User not found.", HttpStatus.NOT_FOUND);
        if (!(rows[0] as any).two_factor_enabled) {
            throw new HttpException("Enable 2FA first.", HttpStatus.BAD_REQUEST);
        }

        const codes = this.generateRecoveryCodes(8);
        await this.pg.query(
            "UPDATE users SET two_factor_recovery_codes = $1 WHERE id = $2",
            [codes, userId],
        );
        return codes;
    }

    private generateRecoveryCodes(n: number): string[] {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const part = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
        const code = () => `${part()}-${part()}-${part()}`;
        return Array.from({ length: n }, code);
    }

    /* ------------------------- Sessions ------------------------- */

    async listSessions(userId: string, currentJti?: string) {
        const { rows } = await this.pg.query<SessionRow>(
            `
      SELECT id,
             user_id,
             jti,
             user_agent,
             ip::text AS ip,
             created_at,
             last_seen_at,
             revoked_at,
             COALESCE(trusted, false) AS trusted
        FROM sessions
       WHERE user_id = $1
         AND revoked_at IS NULL
       ORDER BY last_seen_at DESC, created_at DESC
      `,
            [userId],
        );

        const items = rows.map((r) => ({
            id: r.id,
            createdAt: r.created_at,
            lastSeenAt: r.last_seen_at,
            ip: r.ip,
            userAgent: r.user_agent || "",
            current: currentJti ? String(r.jti ?? r.id) === String(currentJti) : false,
            revokedAt: undefined,
            trusted: !!r.trusted,
        }));
        return { items, currentJti: currentJti || "" };
    }

    async setSessionTrust(userId: string, sessionId: string, trusted: boolean) {
        const { rows } = await this.pg.query(
            `
      UPDATE sessions
         SET trusted = $3
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
       RETURNING id
      `,
            [sessionId, userId, !!trusted],
        );
        if (rows.length === 0) throw new HttpException("Session not found.", HttpStatus.NOT_FOUND);
        return { trusted: !!trusted };
    }

    async revokeSession(userId: string, sessionId: string, currentJti?: string) {
        if (currentJti && String(sessionId) === String(currentJti)) {
            throw new HttpException("You cannot revoke your current session.", HttpStatus.BAD_REQUEST);
        }
        const { rows } = await this.pg.query(
            `UPDATE sessions
          SET revoked_at = now()
        WHERE id = $1
          AND user_id = $2
          AND revoked_at IS NULL
      RETURNING id`,
            [sessionId, userId],
        );
        if (rows.length === 0) throw new HttpException("Session not found.", HttpStatus.NOT_FOUND);
    }

    async revokeAllOtherSessions(userId: string, currentJti?: string) {
        if (currentJti) {
            await this.pg.query(
                `UPDATE sessions
            SET revoked_at = now()
          WHERE user_id = $1
            AND revoked_at IS NULL
            AND (jti::text IS DISTINCT FROM $2)
            AND (id::text  IS DISTINCT FROM $2)`,
                [userId, String(currentJti)],
            );
        } else {
            await this.pg.query(
                `UPDATE sessions
            SET revoked_at = now()
          WHERE user_id = $1
            AND revoked_at IS NULL`,
                [userId],
            );
        }
    }

    /* ------------------------- Personal Tokens ------------------------- */
    async listTokens(userId: string) {
        const { rows } = await this.pg.query<TokenRow>(
            `
      SELECT id, user_id, name, token_hash, created_at, last_used_at, revoked_at
        FROM personal_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC
      `,
            [userId],
        );
        return {
            items: rows.map((r) => ({
                id: r.id,
                name: r.name,
                createdAt: r.created_at,
                lastUsedAt: r.last_used_at || undefined,
                revokedAt: r.revoked_at || undefined,
            })),
        };
    }

    async createToken(userId: string, name: string) {
        checkRate(`pat:${userId}`);
        if (!name?.trim()) {
            throw new HttpException("Name is required.", HttpStatus.BAD_REQUEST);
        }
        const tokenPlain = this.randomToken();
        const tokenHash = await bcrypt.hash(tokenPlain, 12);
        const ins = await this.pg.query<{ id: string }>(
            `
      INSERT INTO personal_tokens (user_id, name, token_hash)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
            [userId, name.trim(), tokenHash],
        );
        return { token: tokenPlain, id: ins.rows[0].id };
    }

    async revokeToken(userId: string, id: string) {
        const { rows } = await this.pg.query(
            "UPDATE personal_tokens SET revoked_at = now() WHERE id = $1 AND user_id = $2 RETURNING id",
            [id, userId],
        );
        if (rows.length === 0) throw new HttpException("Token not found.", HttpStatus.NOT_FOUND);
    }

    private randomToken() {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
        return Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    /* ------------------------- Overview ------------------------- */
    async securityOverview(userId: string, currentJti?: string) {
        const u = await this.pg.query("SELECT two_factor_enabled FROM users WHERE id = $1", [userId]);
        const twoFactorEnabled = (u.rows[0] as any)?.two_factor_enabled ?? false;
        const sess = await this.listSessions(userId, currentJti);
        const events = (sess.items || []).slice(0, 10).map((s: any) => ({
            id: s.id,
            type: "signed_in" as const,
            at: s.createdAt,
            ip: s.ip,
            userAgent: s.userAgent,
        }));
        return {
            twoFactorEnabled,
            sessions: sess.items,
            events,
        };
    }

    /* ------------------------- WebAuthn (stubs) ------------------------- */
    async webauthnCreateOptions(userId: string, email: string) {
        return {
            rp: { name: "RemoteIQ" },
            user: {
                id: Buffer.from(userId),
                name: email,
                displayName: email,
            },
            challenge: Buffer.from(this.randomToken(), "utf8").toString("base64url"),
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            timeout: 60000,
            attestation: "none",
        } as any;
    }

    async webauthnFinish(_userId: string, _body: any) {
        return {
            id: "cred_" + this.randomToken().slice(0, 8),
            label: "Passkey",
            createdAt: new Date().toISOString(),
        };
    }

    async deleteWebAuthn(_userId: string, _id: string) {
        return { ok: true };
    }
}
