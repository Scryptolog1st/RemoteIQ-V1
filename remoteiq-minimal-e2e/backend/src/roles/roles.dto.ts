import { IsArray, IsOptional, IsString, Length, ArrayNotEmpty } from 'class-validator';

export class CreateRoleDto {
    @IsString()
    @Length(2, 64)
    name!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsArray()
    @IsString({ each: true })
    permissions: string[] = [];
}

export class UpdateRoleDto {
    @IsOptional()
    @IsString()
    @Length(2, 64)
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    permissions?: string[];
}
