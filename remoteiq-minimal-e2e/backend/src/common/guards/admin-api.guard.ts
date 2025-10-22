import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";

/**
 * Simple header-based guard:
 * - If ADMIN_API_KEY is not set, allow (dev-friendly)
 * - If set, require header: x-admin-api-key: <ADMIN_API_KEY>
 */
@Injectable()
export class AdminApiGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const provided = req.headers["x-admin-api-key"] as string | undefined;

        // Dev fallback: no key set => allow
        const expected = process.env.ADMIN_API_KEY?.trim();
        if (!expected) return true;

        if (provided && provided === expected) return true;
        throw new UnauthorizedException("Invalid admin API key");
    }
}
