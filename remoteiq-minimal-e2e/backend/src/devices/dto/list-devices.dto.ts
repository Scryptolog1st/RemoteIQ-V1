// src/devices/dto/list-devices.dto.ts
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListDevicesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(["online", "offline"])
  status?: "online" | "offline";

  @IsOptional()
  os?: string[]; // handled via custom transform in controller

  @IsOptional()
  @IsString()
  q?: string;
}
