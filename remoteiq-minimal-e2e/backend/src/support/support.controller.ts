import { Body, Controller, Get, HttpCode, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { SupportService } from "./support.service";
import { SupportLegal, SupportLegalDto } from "./support.dto";

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller("/api/admin/support")
export class SupportController {
    constructor(private readonly svc: SupportService) { }

    @Get()
    async get(): Promise<SupportLegal | { exists: false }> {
        const row = await this.svc.get();
        return row ?? { exists: false };
    }

    @Post("save")
    @HttpCode(204)
    async save(@Body() body: SupportLegalDto): Promise<void> {
        await this.svc.upsert(body);
    }
}
