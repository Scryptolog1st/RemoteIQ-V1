// backend/src/jobs/jobs.module.ts
import { Module, forwardRef } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";     // PgPoolService
import { CommonModule } from "../common/common.module";        // SocketRegistry
import { WsModule } from "../ws/ws.module";                    // if you use ws gateway/handlers

import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { DispatcherService } from "./dispatcher.service";
import { AgentJobsController } from "./agent-jobs.controller";

@Module({
  imports: [
    StorageModule,                 // provides PgPoolService
    CommonModule,                  // exports SocketRegistry
    forwardRef(() => WsModule),    // keep if you have circular deps with ws
  ],
  controllers: [JobsController, AgentJobsController],
  providers: [JobsService, DispatcherService],
  exports: [JobsService, DispatcherService],
})
export class JobsModule { }
