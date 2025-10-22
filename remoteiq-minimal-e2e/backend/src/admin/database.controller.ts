// backend/src/admin/database.controller.ts
import { Body, Controller, Get, HttpCode, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { DatabaseConfigDto, TestResultDto } from "./database.dto";
import { DatabaseService } from "./database.service";

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller("/api/admin/database")
export class DatabaseController {
    constructor(private readonly svc: DatabaseService) { }

    @Get()
    async getConfig(): Promise<DatabaseConfigDto | { enabled: false }> {
        const cfg = this.svc.getConfig() ?? (await this.svc.loadConfig());
        return cfg ?? { enabled: false } as any;
    }

    @Post("test")
    @HttpCode(200)
    async test(@Body() body: DatabaseConfigDto): Promise<TestResultDto> {
        return this.svc.testConnection(body);
    }

    @Post("save")
    @HttpCode(204)
    async save(@Body() body: DatabaseConfigDto): Promise<void> {
        // Optional: you could also re-test here and reject on failure
        await this.svc.saveConfig(body);
    }

    // Stub endpoint your UI can call for the "Dry-run migration" button
    @Post("migrate/dry-run")
    async dryRun(): Promise<{ ok: true; destructive: false; steps: string[] }> {
        return {
            ok: true,
            destructive: false,
            steps: [
                "Verify connectivity to primary",
                "Check presence of required tables/collections",
                "Plan non-destructive CREATEs/INDEXes if missing",
            ],
        };
    }
}
