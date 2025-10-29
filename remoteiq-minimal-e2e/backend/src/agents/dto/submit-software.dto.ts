import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';

export class SubmitSoftwareItemDto {
    @IsString()
    @Length(1, 256)
    name!: string;

    @IsOptional()
    @IsString()
    @Length(1, 128)
    version?: string;

    @IsOptional()
    @IsString()
    @Length(1, 256)
    publisher?: string;

    // YYYY-MM-DD
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'installDate must be YYYY-MM-DD' })
    installDate?: string;
}

export class SubmitSoftwareDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SubmitSoftwareItemDto)
    items!: SubmitSoftwareItemDto[];
}
