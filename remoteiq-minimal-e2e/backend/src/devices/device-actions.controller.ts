// backend/src/devices/device-actions.controller.ts
import {
    Body,
    Controller,
    HttpCode,
    NotFoundException,
    Param,
    Post,
    UsePipes,
    ValidationPipe,
} from "@nestjs/common";
import { JobsService } from "../jobs/jobs.service";

class ActionRequestDto {
    // Optional free-form reason; kept permissive
    reason?: string;
}

type ActionResponse = {
    accepted: true;
    jobId: string;
};

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller("/api/devices/:id/actions")
export class DeviceActionsController {
    constructor(private readonly jobs: JobsService) { }

    /**
     * Reboot the device.
     * POST /api/devices/:id/actions/reboot -> { accepted, jobId }
     */
    @Post("reboot")
    @HttpCode(202)
    async reboot(
        @Param("id") agentId: string, // this should be the Agent ID your WS layer uses
        @Body() _body: ActionRequestDto
    ): Promise<ActionResponse> {
        if (!agentId) throw new NotFoundException("Missing device id");

        const job = await this.jobs.createRunScriptJob({
            agentId,
            language: "powershell",     // or "bash" if your agent is Linux
            scriptText:
                // Windows reboot (powershell)
                'Start-Process "shutdown" -ArgumentList "/r /t 5" -Verb RunAs',
            timeoutSec: 60,
        });

        return { accepted: true, jobId: job.id };
    }

    /**
     * Trigger patch now.
     * POST /api/devices/:id/actions/patch -> { accepted, jobId }
     */
    @Post("patch")
    @HttpCode(202)
    async patch(
        @Param("id") agentId: string,
        @Body() _body: ActionRequestDto
    ): Promise<ActionResponse> {
        if (!agentId) throw new NotFoundException("Missing device id");

        const job = await this.jobs.createRunScriptJob({
            agentId,
            language: "powershell",
            scriptText:
                // naive Windows Update start (example; replace with your updater)
                'Install-Module PSWindowsUpdate -Force -Scope CurrentUser; Import-Module PSWindowsUpdate; Get-WindowsUpdate -AcceptAll -Install -AutoReboot',
            timeoutSec: 15 * 60,
        });

        return { accepted: true, jobId: job.id };
    }
}
