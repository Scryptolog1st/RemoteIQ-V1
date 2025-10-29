// backend/src/ws/ws.module.ts
import { Module, forwardRef } from "@nestjs/common";
import { AgentGateway } from "./agent.gateway";
import { JobsModule } from "../jobs/jobs.module";
import { CommonModule } from "../common/common.module";
import { StorageModule } from "../storage/storage.module"; // <-- bring PgPoolService into WsModule scope

@Module({
  imports: [
    CommonModule,                 // exports SocketRegistry
    StorageModule,                // exports PgPoolService (required by AgentGateway)
    forwardRef(() => JobsModule), // circular with jobs <-> ws is fine
  ],
  providers: [AgentGateway],
  exports: [AgentGateway],
})
export class WsModule { }
