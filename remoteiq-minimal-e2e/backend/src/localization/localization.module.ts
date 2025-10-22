import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { LocalizationController } from "./localization.controller";
import { LocalizationService } from "./localization.service";

@Module({
    imports: [StorageModule],
    controllers: [LocalizationController],
    providers: [LocalizationService],
    exports: [LocalizationService],
})
export class LocalizationModule { }
