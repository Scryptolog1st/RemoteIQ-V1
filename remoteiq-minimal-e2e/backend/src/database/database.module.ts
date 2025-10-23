//remoteiq-minimal-e2e\backend\src\database\database.module.ts

import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class DatabaseModule { }
