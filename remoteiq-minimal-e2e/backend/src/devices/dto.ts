// src/devices/dto.ts
import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListDevicesQuery {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(200)
    @Transform(({ value }) => (value != null ? parseInt(value, 10) : 25))
    pageSize = 25;

    @IsOptional()
    @IsString()
    cursor?: string | null;

    @IsOptional()
    @IsString()
    q?: string;

    @IsOptional()
    @IsEnum(["online", "offline"], { message: "status must be 'online' or 'offline'" })
    status?: "online" | "offline";

    /** allow multiple ?os=windows&os=linux */
    @IsOptional()
    @Transform(({ value }) => {
        const arr = Array.isArray(value) ? value : value != null ? [value] : [];
        return arr.map((v: string) => String(v).toLowerCase()).filter(Boolean);
    })
    os?: string[];
}
