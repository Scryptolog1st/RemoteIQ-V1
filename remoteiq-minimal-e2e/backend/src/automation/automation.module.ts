import { Module, forwardRef } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { StorageModule } from "../storage/storage.module";
import { JobsModule } from "../jobs/jobs.module";

@Module({
    imports: [
        StorageModule,
        forwardRef(() => JobsModule),
    ],
    providers: [AutomationService],
    exports: [AutomationService],
})
export class AutomationModule { }
