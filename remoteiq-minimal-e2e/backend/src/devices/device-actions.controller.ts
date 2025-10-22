// src/devices/device-actions.controller.ts
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
import { RunsService } from "../jobs/runs.service";

class ActionRequestDto {
    // optional free-form reason; keep it permissive for now
    reason?: string;
}

type ActionResponse = {
    accepted: true;
    jobId: string;
};

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller("/api/devices/:id/actions")
export class DeviceActionsController {
    constructor(private readonly runs: RunsService) { }

    /**
     * Reboot the device.
     * Frontend: POST /api/devices/:id/actions/reboot  -> { accepted, jobId }
     */
    @Post("reboot")
    @HttpCode(202)
    async reboot(
        @Param("id") deviceId: string,
        @Body() _body: ActionRequestDto
    ): Promise<ActionResponse> {
        if (!deviceId) throw new NotFoundException("Missing device id");
        const jobId = await this.runs.startRun({
            deviceId,
            script: "reboot",
            shell: "bash", // you can switch to powershell for Windows later if desired
            timeoutSec: 30,
        });
        return { accepted: true, jobId };
    }

    /**
     * Trigger patch now.
     * Frontend: POST /api/devices/:id/actions/patch -> { accepted, jobId }
     */
    @Post("patch")
    @HttpCode(202)
    async patch(
        @Param("id") deviceId: string,
        @Body() _body: ActionRequestDto
    ): Promise<ActionResponse> {
        if (!deviceId) throw new NotFoundException("Missing device id");
        const jobId = await this.runs.startRun({
            deviceId,
            script: "patch-now",
            shell: "bash",
            timeoutSec: 300,
        });
        return { accepted: true, jobId };
    }
}
