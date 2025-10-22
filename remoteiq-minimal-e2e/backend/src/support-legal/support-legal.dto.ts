import { IsOptional, IsString, IsEmail, IsUrl } from "class-validator";

export class SupportLegalDto {
    @IsOptional() @IsEmail() supportEmail?: string;
    @IsOptional() @IsString() supportPhone?: string;

    @IsOptional() @IsUrl({ require_protocol: true }) knowledgeBaseUrl?: string;
    @IsOptional() @IsUrl({ require_protocol: true }) statusPageUrl?: string;

    @IsOptional() @IsUrl({ require_protocol: true }) privacyPolicyUrl?: string;
    @IsOptional() @IsUrl({ require_protocol: true }) termsUrl?: string;

    @IsOptional() @IsEmail() gdprContactEmail?: string;
    @IsOptional() @IsString() legalAddress?: string;

    @IsOptional() @IsUrl({ require_protocol: true }) ticketPortalUrl?: string;
    @IsOptional() @IsString() phoneHours?: string;

    @IsOptional() @IsString() notesHtml?: string;
}

/** Returned to callers (id is fixed to 1 for the singleton row). */
export type SupportLegal = SupportLegalDto & { id: 1 };
