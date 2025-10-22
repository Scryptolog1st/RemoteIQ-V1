import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsJWT, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class Verify2FADto {
    @IsJWT()
    @ApiPropertyOptional({ description: "Short-lived challenge token returned from /api/auth/login when 2FA is required" })
    challengeToken!: string;

    @IsOptional()
    @IsBoolean()
    @ApiPropertyOptional({ description: "When true, mark this device as trusted for future logins" })
    rememberDevice?: boolean;

    @IsOptional()
    @IsString()
    @Matches(/^\d{6,8}$/, { message: "code must be 6–8 digits" })
    @ApiPropertyOptional({ description: "6–8 digit TOTP code from authenticator app" })
    code?: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @ApiPropertyOptional({ description: "Single-use recovery code" })
    recoveryCode?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: "Optional client-side device fingerprint" })
    deviceFingerprint?: string;
}
