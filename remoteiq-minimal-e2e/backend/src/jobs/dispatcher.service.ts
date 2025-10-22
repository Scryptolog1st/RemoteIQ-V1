import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { SocketRegistry } from "../common/socket-registry.service";
import { JobsService } from "./jobs.service";

type RunScriptPayload = {
  language: "powershell" | "bash";
  scriptText: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutSec?: number;
};

@Injectable()
export class DispatcherService {
  private readonly logger = new Logger("Dispatcher");

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SocketRegistry) private readonly sockets: SocketRegistry,
    @Inject(forwardRef(() => JobsService)) private readonly jobs: JobsService,
  ) { }

  async tryDispatch(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    const socket = this.sockets.get(job.agentId);
    if (!socket) {
      this.logger.debug(`Agent ${job.agentId} not connected; job ${job.id} stays queued`);
      return;
    }

    const payload = JSON.parse(job.payload as unknown as string) as RunScriptPayload;

    socket.send(
      JSON.stringify({
        t: "job_run_script",
        jobId: job.id,
        language: payload.language,
        scriptText: payload.scriptText,
        args: payload.args ?? [],
        env: payload.env ?? {},
        timeoutSec: payload.timeoutSec ?? 120,
      }),
    );

    await this.jobs.markDispatched(job.id);
  }

  async dispatchQueuedForAgent(agentId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { agentId, status: "queued" },
      orderBy: { createdAt: "asc" },
    });
    for (const j of jobs) {
      await this.tryDispatch(j.id);
    }
  }
}
