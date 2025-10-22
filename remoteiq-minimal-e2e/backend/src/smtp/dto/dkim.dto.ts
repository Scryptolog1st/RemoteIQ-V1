import { IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class DkimSaveDto {
    @IsString()
    domain!: string;

    @IsString()
    selector!: string;

    /**
     * Omit or pass empty string to keep the existing key.
     */
    @IsOptional()
    @Transform(({ value }) => (value === "" ? undefined : value))
    @IsString()
    privateKey?: string;
}
