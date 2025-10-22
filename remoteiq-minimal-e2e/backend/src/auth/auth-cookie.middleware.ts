import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";
import { PgPoolService } from "../storage/pg-pool.service";

const SESSION_IDLE_UPDATE_SECS =
    parseInt(process.env.SESSION_IDLE_UPDATE_SECS || "300", 10) || 300;

@Injectable()
export class AuthCookieMiddleware implements NestMiddleware {
    private readonly cookieName: string;

    constructor(
        private readonly jwt: JwtService,
        private readonly pg: PgPoolService,
    ) {
        this.cookieName = process.env.AUTH_COOKIE_NAME || "auth_token";
    }

    async use(req: Request & { user?: any; jti?: string }, res: Response, next: NextFunction) {
        try {
            const token = (req as any).cookies?.[this.cookieName];
            if (!token) return next();

            const payload = await this.jwt.verifyAsync<any>(token, {
                secret: process.env.JWT_SECRET ?? "dev-secret",
            });

            // Normalize to the fields your app expects AND capture JTI
            req.user = {
                id: payload.sub ?? payload.id,
                email: payload.email,
                name: payload.name,
                role: payload.role,
            };
            req.jti = payload.jti;

            // If we have a JTI, ensure it's not revoked and gently bump last_seen
            if (req.jti) {
                const { rows } = await this.pg.query<{ revoked_at: string | null; last_seen_at: string }>(
                    `SELECT revoked_at, last_seen_at FROM sessions WHERE jti = $1 LIMIT 1`,
                    [req.jti],
                );
                if (rows.length > 0) {
                    if (rows[0].revoked_at) {
                        return res.status(401).json({ message: "Session revoked." });
                    }
                    const lastSeen = new Date(rows[0].last_seen_at).getTime();
                    const now = Date.now();
                    if ((now - lastSeen) / 1000 > SESSION_IDLE_UPDATE_SECS) {
                        await this.pg.query(`UPDATE sessions SET last_seen_at = now() WHERE jti = $1`, [req.jti]);
                    }
                }
            }
        } catch {
            // ignore broken/expired token; route can still choose to 401
        }
        next();
    }
}
