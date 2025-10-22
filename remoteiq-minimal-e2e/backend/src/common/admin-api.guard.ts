import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AdminApiGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.header("x-admin-api-key");
    const expected = process.env.ADMIN_API_KEY || "";
    if (!expected || key !== expected) {
      throw new UnauthorizedException("Invalid or missing x-admin-api-key");
    }
    return true;
  }
}