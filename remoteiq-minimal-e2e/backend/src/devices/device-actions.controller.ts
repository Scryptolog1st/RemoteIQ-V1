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
import { PgPoolService } from "../storage/pg-pool.service";
import { UninstallSoftwareDto } from "./dto/uninstall-software.dto";

class ActionRequestDto {
    // Optional free-form reason; kept permissive
    reason?: string;
}

type ActionResponse = { accepted: true; jobId: string };

// Resolve :id to an agentId. If there is a device row with that id, return its agent_id.
// Otherwise, treat the id as an agentId directly (back-compat with existing callers).
async function resolveAgentIdOrThrow(pg: PgPoolService, id: string): Promise<string> {
    const key = String(id);
    const { rows } = await pg.query<{ agent_id: string }>(
        `SELECT agent_id FROM devices WHERE id = $1 LIMIT 1`,
        [key],
    );
    if (rows.length && rows[0]?.agent_id) {
        return String(rows[0].agent_id);
    }
    // Back-compat: allow direct agentId usage if device not found
    return key;
}

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller("/api/devices/:id/actions")
export class DeviceActionsController {
    constructor(
        private readonly jobs: JobsService,
        private readonly pg: PgPoolService,
    ) { }

    /**
     * Reboot the device.
     * POST /api/devices/:id/actions/reboot -> { accepted, jobId }
     */
    @Post("reboot")
    @HttpCode(202)
    async reboot(
        @Param("id") id: string,
        @Body() _body: ActionRequestDto
    ): Promise<ActionResponse> {
        if (!id) throw new NotFoundException("Missing device id");

        const agentId = await resolveAgentIdOrThrow(this.pg, id);

        const job = await this.jobs.createRunScriptJob({
            agentId,
            language: "powershell",     // Windows reboot (powershell)
            scriptText: 'Start-Process "shutdown" -ArgumentList "/r /t 5" -Verb RunAs',
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
        @Param("id") id: string,
        @Body() _body: ActionRequestDto
    ): Promise<ActionResponse> {
        if (!id) throw new NotFoundException("Missing device id");

        const agentId = await resolveAgentIdOrThrow(this.pg, id);

        const job = await this.jobs.createRunScriptJob({
            agentId,
            language: "powershell",
            // Example PSWindowsUpdate invocation (placeholder; keep your real script as needed)
            scriptText:
                'Install-Module PSWindowsUpdate -Force -Scope CurrentUser; Import-Module PSWindowsUpdate; Get-WindowsUpdate -AcceptAll -Install -AutoReboot',
            timeoutSec: 15 * 60,
        });

        return { accepted: true, jobId: job.id };
    }

    /**
     * Uninstall software by display name.
     * POST /api/devices/:id/actions/uninstall { name, version? } -> { accepted, jobId }
     */
    @Post("uninstall")
    @HttpCode(202)
    async uninstall(
        @Param("id") id: string,
        @Body() body: UninstallSoftwareDto
    ): Promise<ActionResponse> {
        if (!id) throw new NotFoundException("Missing device id");
        if (!body?.name) throw new NotFoundException("Missing software name");

        const agentId = await resolveAgentIdOrThrow(this.pg, id);

        // Prefer an uninstall string lookup; otherwise attempt ARP-guided uninstall
        const ps = `
$ErrorActionPreference = 'Stop'
$targetName = ${JSON.stringify(body.name)}
$apps = @()
$apps += Get-ItemProperty "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue
$apps += Get-ItemProperty "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue
$target = $apps | Where-Object { $_.DisplayName -eq $targetName } | Select-Object -First 1
if (-not $target) { Write-Error "App not found: $targetName"; exit 2 }
$uninstall = $target.UninstallString
if (-not $uninstall) { Write-Error "No uninstall string found for $targetName"; exit 3 }
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $uninstall -Wait -NoNewWindow -PassThru | Out-Null
exit $LASTEXITCODE
        `.trim();

        const job = await this.jobs.createRunScriptJob({
            agentId,
            language: "powershell",
            scriptText: ps,
            timeoutSec: 30 * 60, // allow time for larger uninstallers
        });

        return { accepted: true, jobId: job.id };
    }
}
