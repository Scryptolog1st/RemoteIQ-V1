// src/health/health.controller.ts
import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("/healthz")
  health() {
    return { ok: true, service: "remoteiq-backend", time: new Date().toISOString() };
  }
}
