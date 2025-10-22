import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";

@Module({
    imports: [StorageModule],
    controllers: [SupportController],
    providers: [SupportService],
    exports: [SupportService],
})
export class SupportModule { }
