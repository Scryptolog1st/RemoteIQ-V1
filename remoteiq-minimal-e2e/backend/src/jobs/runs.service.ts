// backend/src/jobs/runs.service.ts
import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AgentGateway } from "../ws/agent.gateway";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type JobSnapshot = {
    jobId: string;
    deviceId: string;
    status: JobStatus;
    log: string;
    exitCode?: number | null;
    startedAt: number;
    finishedAt?: number | null;
};

export type StartRunInput = {
    deviceId: string;
    script: string;
    shell?: "powershell" | "bash" | "cmd";
    timeoutSec?: number;
};

@Injectable()
export class RunsService {
    private JOBS = new Map<string, JobSnapshot>();

    constructor(
        @Inject(forwardRef(() => AgentGateway))
        private readonly ws: AgentGateway
    ) { }

    get(jobId: string) {
        return this.JOBS.get(jobId);
    }

    async startRun(input: StartRunInput): Promise<string> {
        const jobId = randomUUID();
        const snap: JobSnapshot = {
            jobId,
            deviceId: input.deviceId,
            status: "queued",
            log: "",
            startedAt: Date.now(),
        };
        this.JOBS.set(jobId, snap);

        this.broadcast(jobId, { status: "queued", progress: 0 });

        // --- Simulated execution: replace these timers with real agent execution ---
        setTimeout(() => {
            this.append(jobId, `$ ${input.shell ?? "ps"} executing...\n`, { status: "running", progress: 5 });
        }, 300);

        setTimeout(() => {
            this.append(jobId, "Doing work...\n", { status: "running", progress: 40 });
        }, 1000);

        setTimeout(() => {
            this.append(jobId, "Halfway there...\n", { status: "running", progress: 65 });
        }, 1800);

        setTimeout(() => {
            this.append(jobId, "Finishing...\n", { status: "running", progress: 90 });
        }, 2500);

        setTimeout(() => {
            const done = this.JOBS.get(jobId);
            if (!done) return;
            done.status = "succeeded";
            done.exitCode = 0;
            done.finishedAt = Date.now();
            done.log += "Done.\n";
            this.broadcast(jobId, { status: "succeeded", progress: 100, chunk: "Done.\n", exitCode: 0 });
        }, 3200);
        // ---------------------------------------------------------------------------

        return jobId;
    }

    private append(jobId: string, chunk: string, payload: { status: JobStatus; progress?: number }) {
        const snap = this.JOBS.get(jobId);
        if (!snap) return;
        snap.status = payload.status;
        snap.log += chunk;
        this.broadcast(jobId, { status: payload.status, progress: payload.progress ?? 0, chunk });
    }

    private broadcast(
        jobId: string,
        data: { status: JobStatus; progress?: number; chunk?: string; exitCode?: number | null }
    ) {
        this.ws.broadcast({
            type: "job.run.updated",
            jobId,
            status: data.status,
            progress: typeof data.progress === "number" ? data.progress : undefined,
            chunk: data.chunk,
            exitCode: data.exitCode ?? null,
            finishedAt: data.status === "succeeded" || data.status === "failed" ? new Date().toISOString() : null,
        });
    }
}
