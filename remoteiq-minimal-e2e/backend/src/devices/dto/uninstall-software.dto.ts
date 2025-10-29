//remoteiq-minimal-e2e\backend\src\devices\dto\uninstall-software.dto.ts

import { IsOptional, IsString } from "class-validator";

export class UninstallSoftwareDto {
    @IsString()
    name!: string;

    @IsOptional()
    @IsString()
    version?: string;
}
