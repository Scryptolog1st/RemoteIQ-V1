import { Body, Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { AgentTokenGuard, getAgentFromRequest } from "../common/agent-token.util";
import { Req } from "@nestjs/common";

@Controller("/api/agent/jobs")
export class AgentJobsController {
    constructor(private readonly jobs: JobsService) { }

    // Agent says: I started running this job
    @Post(":id/running")
    @UseGuards(AgentTokenGuard)
    @HttpCode(204)
    async running(@Req() req: any, @Param("id") jobId: string) {
        // (optional) verify job belongs to this agent: compare req.agent.id with jobs.getJobWithResult(jobId).agent_id
        await this.jobs.markRunning(jobId);
    }

    // Agent says: I finished this job (success/fail/timeout)
    @Post(":id/finish")
    @UseGuards(AgentTokenGuard)
    @HttpCode(204)
    async finish(
        @Req() req: any,
        @Param("id") jobId: string,
        @Body()
        body: {
            status: "succeeded" | "failed" | "timeout";
            exitCode: number;
            stdout: string;
            stderr: string;
            durationMs: number;
        },
    ) {
        await this.jobs.finishJob(
            jobId,
            {
                exitCode: body.exitCode ?? -1,
                stdout: body.stdout ?? "",
                stderr: body.stderr ?? "",
                durationMs: Math.max(0, body.durationMs ?? 0),
            },
            body.status,
        );
    }
}
