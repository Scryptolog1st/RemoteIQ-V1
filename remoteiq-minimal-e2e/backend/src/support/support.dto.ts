import { IsEmail, IsOptional, IsString } from "class-validator";

export class SupportLegalDto {
    @IsOptional() @IsString() supportUrl?: string;
    @IsOptional() @IsString() statusUrl?: string;
    @IsOptional() @IsString() termsUrl?: string;
    @IsOptional() @IsString() privacyUrl?: string;
    @IsOptional() @IsString() kbUrl?: string;
    @IsOptional() @IsEmail() contactEmail?: string;
    @IsOptional() @IsString() supportPhone?: string;
    @IsOptional() @IsString() legalVersion?: string;
}

export type SupportLegal = SupportLegalDto & { id: 1 };
