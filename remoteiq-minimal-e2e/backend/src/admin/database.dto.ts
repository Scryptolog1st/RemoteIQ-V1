// backend/src/admin/database.dto.ts
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";

export type DbEngine = "postgresql" | "mysql" | "mssql" | "sqlite" | "mongodb";
export type DbAuthMode = "fields" | "url";
export type StorageDomain =
    | "users" | "roles" | "sessions" | "audit_logs" | "devices" | "policies" | "email_queue";

export class DatabaseMappingsDto {
    @IsString() users!: string;
    @IsString() roles!: string;
    @IsString() sessions!: string;
    @IsString() audit_logs!: string;
    @IsString() devices!: string;
    @IsString() policies!: string;
    @IsString() email_queue!: string;
}

export class DatabaseConfigDto {
    @IsBoolean() enabled!: boolean;

    @IsEnum(["postgresql", "mysql", "mssql", "sqlite", "mongodb"])
    engine!: DbEngine;

    @IsEnum(["fields", "url"])
    authMode!: DbAuthMode;

    // url mode
    @IsOptional() @IsString() url?: string;

    // fields mode
    @IsOptional() @IsString() host?: string;

    @IsOptional()
    @IsInt() @Min(1) @Max(65535)
    @Transform(({ value }) => (value != null ? parseInt(value, 10) : undefined))
    port?: number;

    @IsOptional() @IsString() dbName?: string;
    @IsOptional() @IsString() username?: string;
    @IsOptional() @IsString() password?: string;

    @IsBoolean() ssl!: boolean;

    @IsInt() @Min(0) @Max(1000) poolMin!: number;
    @IsInt() @Min(1) @Max(5000) poolMax!: number;

    @IsOptional() @IsString()
    readReplicas?: string; // comma-separated URLs

    @IsObject() @Type(() => DatabaseMappingsDto)
    mappings!: DatabaseMappingsDto;
}

export class TestResultDto {
    ok!: boolean;
    engine!: DbEngine;
    primary!: { ok: boolean; message?: string };
    replicas?: Array<{ url: string; ok: boolean; message?: string }>;
    note?: string;
}
