//backend\src\auth\auth.module.ts

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { StorageModule } from "../storage/storage.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UserAuthService } from "./user-auth.service";

function parseExpiresToSeconds(input: string | undefined, fallbackSeconds: number): number {
  if (!input) return fallbackSeconds;
  if (/^\d+$/.test(input)) return Number(input);
  const m = input.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return fallbackSeconds;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const factor = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : unit === "d" ? 86400 : 1;
  return n * factor;
}
const EXPIRES_IN_SECONDS = parseExpiresToSeconds(process.env.JWT_EXPIRES, 60 * 60 * 24 * 7);

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-secret",
      signOptions: { expiresIn: EXPIRES_IN_SECONDS },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserAuthService],
  exports: [AuthService, UserAuthService, JwtModule],
})
export class AuthModule { }
