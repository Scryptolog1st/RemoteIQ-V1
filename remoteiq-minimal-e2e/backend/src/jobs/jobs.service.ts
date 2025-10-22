import { Injectable, NotFoundException, Logger, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { DispatcherService } from "./dispatcher.service";

type RunScriptInput = {
  agentId: string;
  language: "powershell";
  scriptText: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutSec?: number;
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger("JobsService");

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DispatcherService)) private readonly dispatcher: DispatcherService,
  ) { }

  async createRunScriptJob(input: RunScriptInput) {
    const agent = await this.prisma.agent.findUnique({ where: { id: input.agentId } });
    if (!agent) throw new NotFoundException("Agent not found");

    const job = await this.prisma.job.create({
      data: {
        agentId: input.agentId,
        type: "RUN_SCRIPT",
        payload: JSON.stringify({
          language: input.language,
          scriptText: input.scriptText,
          args: input.args ?? [],
          env: input.env ?? {},
          timeoutSec: input.timeoutSec ?? 120,
        }),
        status: "queued",
      },
    });

    // fire-and-forget dispatch
    this.dispatcher.tryDispatch(job.id).catch((e: any) => {
      this.logger.warn(`Dispatch failed for job ${job.id}: ${e?.message ?? e}`);
    });

    return job;
  }

  async getJobWithResult(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { result: true },
    });
    if (!job) throw new NotFoundException("Job not found");
    return job;
  }

  async markDispatched(jobId: string) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: "dispatched", dispatchedAt: new Date() },
    });
  }

  async markRunning(jobId: string) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date() },
    });
  }

  async finishJob(
    jobId: string,
    result: { exitCode: number; stdout: string; stderr: string; durationMs: number },
    status: "succeeded" | "failed" | "timeout",
  ) {
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: jobId },
        data: { status, finishedAt: new Date() },
      }),
      this.prisma.jobResult.create({
        data: {
          jobId,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.durationMs,
        },
      }),
    ]);
  }
}
