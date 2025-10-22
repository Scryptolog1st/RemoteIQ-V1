// backend/src/company/company.dto.ts
import { IsEmail, IsOptional, IsString } from "class-validator";

export class CompanyProfileDto {
    @IsString() name!: string;
    @IsOptional() @IsString() legalName?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() fax?: string;
    @IsOptional() @IsString() website?: string;
    @IsOptional() @IsString() vatTin?: string;
    @IsOptional() @IsString() address1?: string;
    @IsOptional() @IsString() address2?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() state?: string;
    @IsOptional() @IsString() postal?: string;
    @IsOptional() @IsString() country?: string;
}

// Returned to the client (single-row model with fixed id=1)
export type CompanyProfile = CompanyProfileDto & { id: 1 };
