// backend/src/users/me.dto.ts
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Partial update of the current user's profile.
 * Only provided fields are updated.
 */
export class UpdateMeDto {
    @IsOptional() @IsString() @MaxLength(120)
    name?: string;

    @IsOptional() @IsEmail()
    email?: string;

    @IsOptional() @IsString() @MaxLength(32)
    phone?: string;

    @IsOptional() @IsString() @MaxLength(64)
    timezone?: string;

    @IsOptional() @IsString() @MaxLength(16)
    locale?: string;

    // address block (all optional)
    @IsOptional() @IsString() @MaxLength(120)
    address1?: string;

    @IsOptional() @IsString() @MaxLength(120)
    address2?: string;

    @IsOptional() @IsString() @MaxLength(64)
    city?: string;

    @IsOptional() @IsString() @MaxLength(64)
    state?: string;

    @IsOptional() @IsString() @MaxLength(32)
    postal?: string;

    @IsOptional() @IsString() @MaxLength(64)
    country?: string;

    // avatar (normally set by upload API — left here for completeness)
    @IsOptional() @IsString() @MaxLength(512)
    avatarUrl?: string;

    @IsOptional() @IsString() @MaxLength(512)
    avatarThumbUrl?: string;
}
