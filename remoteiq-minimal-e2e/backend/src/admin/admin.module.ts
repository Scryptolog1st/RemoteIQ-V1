// backend/src/admin/admin.module.ts
// (No company imports here; this module is only for "admin" endpoints like database config.)
import { Module } from "@nestjs/common";
import { DatabaseController } from "./database.controller";
import { DatabaseService } from "./database.service";
import { StorageModule } from "../storage/storage.module";

@Module({
    imports: [StorageModule],
    controllers: [DatabaseController],
    providers: [DatabaseService],
    exports: [DatabaseService],
})
export class AdminModule { }
