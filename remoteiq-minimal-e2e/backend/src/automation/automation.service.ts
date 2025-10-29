import { Injectable, NotFoundException } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import { JobsService } from "../jobs/jobs.service";

type EnqueueArgs = {
    deviceId: string;
    script: string;
    shell?: "powershell" | "bash" | "cmd";
    timeoutSec?: number;
};

@Injectable()
export class AutomationService {
    constructor(
        private readonly pg: PgPoolService,
        private readonly jobs: JobsService,
    ) { }

    /**
     * Enqueue a run-script job for the latest agent of a device.
     * We queue even if the agent isn't currently connected; Dispatcher will try to send when it is.
     */
    async enqueue(args: EnqueueArgs): Promise<{ jobId: string }> {
        const { deviceId, script } = args;
        if (!deviceId || !script) throw new NotFoundException("Missing deviceId or script");

        // Find an agent for this device (latest updated)
        const { rows } = await this.pg.query<{ id: string }>(
            `SELECT id
         FROM agents
        WHERE device_id = $1
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
            [deviceId],
        );

        const agent = rows[0];
        if (!agent) throw new NotFoundException("Agent not found for this device");

        const job = await this.jobs.createRunScriptJob({
            agentId: agent.id,
            language: (args.shell === "powershell" ? "powershell" : "bash"), // map "cmd" to bash for now if needed
            scriptText: args.script,
            args: [],
            env: {},
            timeoutSec: args.timeoutSec ?? 1800,
        });

        return { jobId: job.id };
    }
}
