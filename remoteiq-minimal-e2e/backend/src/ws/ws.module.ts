// backend/src/ws/ws.module.ts
import { Module, forwardRef } from "@nestjs/common";
import { AgentGateway } from "./agent.gateway";
import { DashboardGateway } from "./dashboard.gateway";
import { JobsModule } from "../jobs/jobs.module";
import { CommonModule } from "../common/common.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [
    CommonModule,                 // SocketRegistry + UiSocketRegistry
    StorageModule,                // PgPoolService (AgentGateway/DashboardGateway)
    forwardRef(() => JobsModule), // circular with jobs <-> ws is fine
  ],
  providers: [AgentGateway, DashboardGateway],
  exports: [AgentGateway, DashboardGateway],
})
export class WsModule { }
