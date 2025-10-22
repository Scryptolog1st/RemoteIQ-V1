import { Module, forwardRef } from "@nestjs/common";
import { DevicesController } from "./devices.controller";
import { DeviceActionsController } from "./device-actions.controller";
import { DeviceInsightsController } from "./device-insights.controller";
import { JobsModule } from "../jobs/jobs.module";
import { StorageModule } from "../storage/storage.module";
import { DevicesService } from "./devices.service";

@Module({
  imports: [StorageModule, forwardRef(() => JobsModule)],
  controllers: [DevicesController, DeviceActionsController, DeviceInsightsController],
  providers: [DevicesService],
})
export class DevicesModule { }
