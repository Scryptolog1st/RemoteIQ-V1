import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { SupportLegalController } from "./support-legal.controller";
import { SupportLegalService } from "./support-legal.service";

@Module({
    imports: [StorageModule],
    controllers: [SupportLegalController],
    providers: [SupportLegalService],
    exports: [SupportLegalService],
})
export class SupportLegalModule { }
