// backend/src/company/company.module.ts
import { Module } from "@nestjs/common";
import { CompanyController } from "./company.controller";
import { CompanyService } from "./company.service";
import { StorageModule } from "../storage/storage.module"; // PgPoolService provider

@Module({
    imports: [StorageModule],
    controllers: [CompanyController],
    providers: [CompanyService],
    exports: [CompanyService],
})
export class CompanyModule { }
