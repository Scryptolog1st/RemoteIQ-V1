import { Body, Controller, Get, HttpCode, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { LocalizationService } from "./localization.service";
import { LocalizationDto, LocalizationRow } from "./localization.dto";

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller("/api/admin/localization")
export class LocalizationController {
    constructor(private readonly svc: LocalizationService) { }

    @Get()
    async get(): Promise<LocalizationRow | { exists: false }> {
        const row = await this.svc.get();
        return row ?? { exists: false };
    }

    @Post("save")
    @HttpCode(204)
    async save(@Body() body: LocalizationDto): Promise<void> {
        // Note: DTO is whitelisted; any unexpected props (like id) are dropped.
        await this.svc.upsert(body);
    }
}
