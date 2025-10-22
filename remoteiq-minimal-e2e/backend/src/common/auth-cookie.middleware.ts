import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";

type AnyReq = Request & { user?: any };

@Injectable()
export class AuthCookieMiddleware implements NestMiddleware {
    constructor(private readonly jwt: JwtService) { }

    use(req: AnyReq, _res: Response, next: NextFunction) {
        try {
            const cookieName = process.env.AUTH_COOKIE_NAME || "auth_token";
            const token = (req as any).cookies?.[cookieName];

            if (!token) {
                return next();
            }

            // If tokens were signed with "sub" as user id (recommended)
            const payload = this.jwt.verify(token, {
                secret: process.env.JWT_SECRET ?? "dev-secret",
            });

            // Normalize a common shape for controllers:
            // prefer `sub`, but support `id` for older tokens
            const id = (payload as any).sub ?? (payload as any).id;
            if (id) {
                req.user = {
                    id,
                    email: (payload as any).email,
                    name: (payload as any).name,
                    role: (payload as any).role,
                };
            }
        } catch {
            // ignore invalid/expired token; route can still be public
        }
        next();
    }
}
