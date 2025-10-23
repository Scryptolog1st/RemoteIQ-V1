//remoteiq-minimal-e2e\backend\src\auth\user-auth.service.ts

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PgPoolService } from "../storage/pg-pool.service";
import { randomUUID, createHash, createHmac } from "crypto";

type WebUser = { id: string; email: string; name: string; role: "admin" | "user" | string };

// DB user type that includes 2FA fields when needed
type DbUser = {
    id: string;
    email: string;
    name: string | null;
    role: string | null;
    status?: string;
    suspended?: boolean | null;
    password_hash?: string | null;
    two_factor_enabled?: boolean | null;
    two_factor_secret?: string | null;            // base32 or otpauth URI
    two_factor_recovery_codes?: string[] | null;  // stored as hashes
};

@Injectable()
export class UserAuthService {
    constructor(
        private readonly jwt: JwtService,
        private readonly pg: PgPoolService,
    ) { }

    /** Validate against Postgres users table */
    async validateUser(email: string, password: string): Promise<WebUser> {
        const { rows } = await this.pg.query(
            `
      SELECT id, name, email, role, status, suspended, password_hash
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
            [email],
        );

        const u = rows[0];
        if (!u) throw new UnauthorizedException("Invalid email or password");
        if (u.status !== "active" || u.suspended === true) {
            throw new UnauthorizedException("Invalid email or password");
        }
        if (!u.password_hash || typeof u.password_hash !== "string") {
            throw new UnauthorizedException("Invalid email or password");
        }

        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) throw new UnauthorizedException("Invalid email or password");

        const role: string = u.role || "User";
        return { id: u.id, email: u.email, name: u.name, role };
    }

    /** Issue a JWT **with JTI** (uses JwtModule config). */
    async signWithJti(user: WebUser): Promise<{ token: string; jti: string }> {
        const jti = randomUUID();
        const token = await this.jwt.signAsync({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            jti,
        });
        return { token, jti };
    }

    /** Back-compat signer without JTI (not used by login anymore) */
    async sign(user: WebUser): Promise<string> {
        return this.jwt.signAsync({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });
    }

    /** Verify cookie token and re-hydrate a minimal user */
    async verify(token: string): Promise<WebUser | null> {
        try {
            const payload = await this.jwt.verifyAsync<{ sub: string; email: string; name?: string; role: string }>(token);
            const { rows } = await this.pg.query(
                `SELECT id, name, email, role, status, suspended FROM users WHERE id = $1 LIMIT 1`,
                [payload.sub],
            );
            const u = rows[0];
            if (!u || u.status !== "active" || u.suspended === true) return null;
            return { id: u.id, email: u.email, name: u.name, role: u.role || "User" };
        } catch {
            return null;
        }
    }

    /** Record a session row keyed by JTI (upsert on jti). */
    async recordSessionOnLogin(userId: string, jti: string, ua?: string, ip?: string) {
        await this.pg.query(
            `
      INSERT INTO sessions (user_id, jti, user_agent, ip)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (jti) DO UPDATE
         SET last_seen_at = now(),
             user_agent   = COALESCE(EXCLUDED.user_agent, sessions.user_agent),
             ip           = COALESCE(EXCLUDED.ip, sessions.ip)
      `,
            [userId, jti, ua || null, ip || null],
        );
    }

    // =============== 2FA: feature toggles & device trust =================

    async isTwoFactorEnabled(userId: string): Promise<boolean> {
        try {
            const { rows } = await this.pg.query<{ enabled: boolean }>(
                `
      select
        (coalesce(two_factor_enabled,false) = true)
        and (two_factor_secret is not null and length(trim(two_factor_secret)) > 0)
        as enabled
      from users
      where id = $1
      limit 1
      `,
                [userId],
            );
            return !!rows[0]?.enabled;
        } catch (e: any) {
            if (e?.code === "42703") return false; // columns not migrated yet
            throw e;
        }
    }


    async isDeviceTrusted(userId: string, deviceFingerprint: string | null): Promise<boolean> {
        if (!deviceFingerprint) return false;
        try {
            const { rows } = await this.pg.query(
                `SELECT 1
           FROM trusted_devices
          WHERE user_id = $1
            AND device_fingerprint = $2
            AND now() < expires_at
          LIMIT 1`,
                [userId, deviceFingerprint],
            );
            return !!rows[0];
        } catch {
            // table may not exist yet
            return false;
        }
    }

    async trustCurrentDevice(userId: string, deviceFingerprint: string) {
        try {
            await this.pg.query(
                `INSERT INTO trusted_devices (user_id, device_fingerprint, created_at, expires_at)
         VALUES ($1, $2, now(), now() + interval '90 days')
         ON CONFLICT (user_id, device_fingerprint)
         DO UPDATE SET expires_at = EXCLUDED.expires_at`,
                [userId, deviceFingerprint],
            );
        } catch {
            // ignore if table not present
        }
    }

    // =============== 2FA: challenge token (short-lived) ==================

    async createChallengeToken(userId: string): Promise<{ token: string; jti: string }> {
        const jti = randomUUID();
        const token = await this.jwt.signAsync(
            { sub: userId, typ: "2fa_challenge", jti },
            { expiresIn: "10m" },
        );
        try {
            await this.pg.query(
                `INSERT INTO login_challenges (id, user_id, created_at)
         VALUES ($1, $2, now())
         ON CONFLICT DO NOTHING`,
                [jti, userId],
            );
        } catch {
            // ignore if table not present
        }
        return { token, jti };
    }

    async verifyChallengeToken(challengeToken: string): Promise<{ userId: string; jti: string }> {
        let decoded: any;
        try {
            decoded = await this.jwt.verifyAsync(challengeToken);
        } catch {
            throw new UnauthorizedException("Invalid or expired challenge");
        }
        if (!decoded?.sub || decoded?.typ !== "2fa_challenge" || !decoded?.jti) {
            throw new UnauthorizedException("Invalid challenge");
        }
        return { userId: decoded.sub as string, jti: decoded.jti as string };
    }

    // =============== 2FA: verification (TOTP or recovery) =================

    async verifyTOTP(userId: string, code: string): Promise<boolean> {
        const u = await this.findUserTwoFactor(userId);
        if (!u?.two_factor_enabled || !u.two_factor_secret) return false;

        // Accept otpauth:// URIs & normalize base32 secret
        const normalized = this.normalizeTotpSecret(u.two_factor_secret);
        return this.verifyTotpBasic(normalized, code.trim());
    }

    async consumeRecoveryCode(userId: string, recoveryCode: string): Promise<boolean> {
        const u = await this.findUserTwoFactor(userId);
        if (!u) return false;
        const codes = u.two_factor_recovery_codes || [];
        if (codes.length === 0) return false;

        const candidateHash = this.sha256Hex(recoveryCode.trim().toLowerCase());
        const idx = codes.findIndex((h) => h === candidateHash);
        if (idx === -1) return false;

        const next = [...codes.slice(0, idx), ...codes.slice(idx + 1)];
        await this.pg.query(
            `UPDATE users SET two_factor_recovery_codes = $1 WHERE id = $2`,
            [next, userId],
        );
        return true;
    }

    // =============== Lookups =================

    async findUserById(userId: string): Promise<WebUser> {
        const { rows } = await this.pg.query<DbUser>(
            `SELECT id, name, email, role FROM users WHERE id = $1 LIMIT 1`,
            [userId],
        );
        const u = rows[0];
        if (!u) throw new UnauthorizedException("User not found");
        return { id: u.id, email: String(u.email), name: String(u.name), role: u.role || "User" };
    }

    async findUserTwoFactor(userId: string): Promise<DbUser | null> {
        try {
            const { rows } = await this.pg.query<DbUser>(
                `SELECT id, two_factor_enabled, two_factor_secret, two_factor_recovery_codes
           FROM users WHERE id = $1 LIMIT 1`,
                [userId],
            );
            return rows[0] ?? null;
        } catch (e: any) {
            // 42703 = undefined_column -> 2FA columns not migrated yet
            if (e?.code === "42703") return null;
            throw e;
        }
    }

    // =============== Minimal TOTP (robust parsing) =================

    /** Accepts raw base32 or full otpauth:// URI; strips spaces and uppercases */
    private normalizeTotpSecret(input: string): string {
        try {
            if (input.toLowerCase().startsWith("otpauth://")) {
                const u = new URL(input);
                const secret = u.searchParams.get("secret") || "";
                return secret.replace(/\s+/g, "").toUpperCase();
            }
        } catch {
            // not a valid URL; fall through
        }
        return input.replace(/\s+/g, "").toUpperCase();
    }

    private sha256Hex(s: string) {
        return createHash("sha256").update(s).digest("hex");
    }

    private verifyTotpBasic(base32Secret: string, code: string): boolean {
        try {
            const secret = this.base32Decode(base32Secret);
            const step = 30;
            const t = Math.floor(Date.now() / 1000 / step);

            // Allow a bit more skew: [-2, -1, 0, +1, +2]
            for (const off of [-2, -1, 0, 1, 2]) {
                const counter = Buffer.alloc(8);
                counter.writeBigUInt64BE(BigInt(t + off));
                const hmac = createHmac("sha1", secret).update(counter).digest();
                const offset = hmac[hmac.length - 1] & 0xf;
                const bin =
                    ((hmac[offset] & 0x7f) << 24) |
                    ((hmac[offset + 1] & 0xff) << 16) |
                    ((hmac[offset + 2] & 0xff) << 8) |
                    (hmac[offset + 3] & 0xff);
                const otp = (bin % 1_000_000).toString().padStart(6, "0");
                if (otp === code) return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    private base32Decode(b32: string): Buffer {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        const clean = b32.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
        let bits = "";
        for (const c of clean) {
            const v = alphabet.indexOf(c);
            if (v < 0) continue;
            bits += v.toString(2).padStart(5, "0");
        }
        const bytes: number[] = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }
        return Buffer.from(bytes);
    }
}
