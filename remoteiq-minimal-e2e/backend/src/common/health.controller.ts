// src/common/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('/healthz')
export class HealthController {
    @Get() get() { return { ok: true, ts: Date.now() }; }
}
