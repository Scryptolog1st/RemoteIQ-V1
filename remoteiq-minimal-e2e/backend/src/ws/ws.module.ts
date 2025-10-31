// backend/src/ws/ws.module.ts
import { Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AgentGateway } from "./agent.gateway";
import { DashboardGateway } from "./dashboard.gateway";

import { JobsModule } from "../jobs/jobs.module";
import { CommonModule } from "../common/common.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [
    CommonModule,                  // SocketRegistry + UiSocketRegistry
    StorageModule,                 // PgPoolService (Agent/Dashboard gateways)
    forwardRef(() => JobsModule),  // circular with jobs <-> ws is fine

    // Provide JwtService for DashboardGateway auth (typing-safe for ms StringValue)
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-secret",
      // jsonwebtoken accepts number (seconds) or ms-format string; cast to satisfy strict types
      signOptions: { expiresIn: ((process.env.JWT_EXPIRES as any) ?? ("7d" as any)) },
    }),
  ],
  providers: [AgentGateway, DashboardGateway],
  exports: [AgentGateway, DashboardGateway],
})
export class WsModule { }
