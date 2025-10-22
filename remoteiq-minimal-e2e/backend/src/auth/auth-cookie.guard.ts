// src/auth/auth-cookie.guard.ts
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtService } from "@nestjs/jwt";
import { PgPoolService } from "../storage/pg-pool.service";
import { randomUUID } from "crypto";

function parseCookieMaxAge(): number {
    const v = process.env.AUTH_COOKIE_MAX_AGE_MS;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 7 * 24 * 60 * 60 * 1000; // 7d
}

@Injectable()
export class AuthCookieGuard implements CanActivate {
    constructor(
        private readonly jwt: JwtService,
        private readonly pg: PgPoolService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<Request>();
        const res = context.switchToHttp().getResponse<Response>();

        const cookieName = process.env.AUTH_COOKIE_NAME || "auth_token";
        const tokenFromCookie =
            (req as any).cookies?.[cookieName] ||
            (req as any).cookies?.["auth_token"];
        const tokenFromHeader =
            req.headers.authorization?.replace(/^Bearer\s+/i, "") || null;

        const token = tokenFromCookie || tokenFromHeader;
        if (!token) throw new UnauthorizedException("No auth token provided");

        let payload: any;
        try {
            payload = await this.jwt.verifyAsync(token);
        } catch {
            throw new UnauthorizedException("Invalid token");
        }
        if (!payload?.sub) throw new UnauthorizedException("Invalid token payload");

        (req as any).user = {
            id: String(payload.sub),
            email: payload.email,
            name: payload.name,
            role: payload.role,
        };

        // Legacy token migration: mint a new token with jti and set cookie
        let jti: string | null = payload?.jti != null ? String(payload.jti) : null;
        if (!jti) {
            jti = randomUUID();
            const newToken = await this.jwt.signAsync({
                sub: payload.sub,
                email: payload.email,
                name: payload.name,
                role: payload.role,
                jti,
            });

            res.cookie(cookieName, newToken, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: parseCookieMaxAge(),
            });

            const ipHdr = (req.headers["x-forwarded-for"] as string) || "";
            const ip = (ipHdr.split(",")[0] || req.ip || "").trim() || null;
            const ua = req.get("user-agent") || null;

            await this.pg.query(
                `
        INSERT INTO sessions (user_id, jti, user_agent, ip)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (jti) DO UPDATE
           SET last_seen_at = now(),
               user_agent   = COALESCE(EXCLUDED.user_agent, sessions.user_agent),
               ip           = COALESCE(EXCLUDED.ip, sessions.ip)
        `,
                [String(payload.sub), jti, ua, ip],
            );
        }

        (req as any).jti = jti;

        // Best-effort "touch"
        if (jti) {
            const ipHdr = (req.headers["x-forwarded-for"] as string) || "";
            const ip = (ipHdr.split(",")[0] || req.ip || "").trim() || null;
            const ua = req.get("user-agent") || null;
            this.pg
                .query(
                    `UPDATE sessions
             SET last_seen_at = now(),
                 ip = COALESCE($2, ip),
                 user_agent = COALESCE($3, user_agent)
           WHERE jti = $1 AND revoked_at IS NULL`,
                    [jti, ip, ua],
                )
                .catch(() => { });
        }

        return true;
    }
}
