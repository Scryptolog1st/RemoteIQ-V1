// backend/src/ws/ws.module.ts
import { Module, forwardRef } from "@nestjs/common";
import { AgentGateway } from "./agent.gateway";
import { JobsModule } from "../jobs/jobs.module";
import { CommonModule } from "../common/common.module";

// ⛔️ NOTE: Removed DatabaseModule import. Not needed for WS.

@Module({
  imports: [
    CommonModule,
    forwardRef(() => JobsModule), // circular with jobs <-> ws
  ],
  providers: [AgentGateway],
  exports: [AgentGateway],
})
export class WsModule { }
