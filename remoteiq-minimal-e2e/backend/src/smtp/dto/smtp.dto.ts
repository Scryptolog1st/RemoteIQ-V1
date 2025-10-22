// backend/src/smtp/dto/smtp.dto.ts
import {
    IsBoolean,
    IsEmail,
    IsIn,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from "class-validator";
import { Type, Transform } from "class-transformer";

export type EmailPurpose = "alerts" | "invites" | "password_resets" | "reports";

/** Normalizes empty-string ports to undefined so validation passes cleanly. */
const Port = () =>
    Transform(({ value }) => {
        if (value === "" || value === null || value === undefined) return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    });

export class SmtpSettingsDto {
    @IsString() host!: string;

    @IsOptional()
    @Port()
    @IsInt()
    @Min(1)
    @Max(65535)
    port?: number;

    @IsString() username!: string;

    /** Omitted or empty-string means "keep existing" on save. */
    @IsOptional()
    @Transform(({ value }) => (value === "" ? undefined : value))
    @IsString()
    password?: string;

    @IsBoolean() useTLS!: boolean;
    @IsBoolean() useSSL!: boolean;
    @IsEmail() fromAddress!: string;
}

export class ImapSettingsDto {
    @IsString() host!: string;

    @IsOptional()
    @Port()
    @IsInt()
    @Min(1)
    @Max(65535)
    port?: number;

    @IsString() username!: string;

    @IsOptional()
    @Transform(({ value }) => (value === "" ? undefined : value))
    @IsString()
    password?: string;

    @IsBoolean() useSSL!: boolean;
}

export class PopSettingsDto {
    @IsString() host!: string;

    @IsOptional()
    @Port()
    @IsInt()
    @Min(1)
    @Max(65535)
    port?: number;

    @IsString() username!: string;

    @IsOptional()
    @Transform(({ value }) => (value === "" ? undefined : value))
    @IsString()
    password?: string;

    @IsBoolean() useSSL!: boolean;
}

export class EmailProfileDto {
    @ValidateNested()
    @Type(() => SmtpSettingsDto)
    smtp!: SmtpSettingsDto;

    @ValidateNested()
    @Type(() => ImapSettingsDto)
    imap!: ImapSettingsDto;

    @ValidateNested()
    @Type(() => PopSettingsDto)
    pop!: PopSettingsDto;

    @IsBoolean() enabled!: boolean;
}

export class SaveEmailConfigDto {
    @IsObject()
    profiles!: Record<EmailPurpose, EmailProfileDto>;
}

export class TestSmtpDto {
    @IsIn(["alerts", "invites", "password_resets", "reports"])
    profile!: EmailPurpose;
}

export class TestImapDto {
    @IsIn(["alerts", "invites", "password_resets", "reports"])
    profile!: EmailPurpose;
}

export class TestPopDto {
    @IsIn(["alerts", "invites", "password_resets", "reports"])
    profile!: EmailPurpose;
}

export class SendTestEmailDto {
    @IsIn(["alerts", "invites", "password_resets", "reports"])
    profile!: EmailPurpose;

    @IsEmail() to!: string;

    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    @IsString()
    body?: string;
}
