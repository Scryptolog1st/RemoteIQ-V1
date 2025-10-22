import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Headers,
  UnauthorizedException,
  Logger,
  Inject,
} from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { PrismaService } from "../database/prisma.service";

@Controller("/api/admin")
export class JobsController {
  private readonly logger = new Logger("JobsController");

  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) { }

  private checkAdmin(key: string | undefined) {
    if (!key || key !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException("invalid admin key");
    }
  }

  @Post("/agents")
  async listAgents(@Headers("x-admin-api-key") key: string | undefined) {
    this.checkAdmin(key);
    try {
      const items = await this.prisma.agent.findMany({
        orderBy: { enrolledAt: "desc" },
      });
      return { items };
    } catch (e: any) {
      this.logger.error(`listAgents failed: ${e?.message ?? e}`, e?.stack ?? undefined);
      throw e;
    }
  }

  @Post("/jobs/run-script")
  async runScript(
    @Headers("x-admin-api-key") key: string | undefined,
    @Body()
    body: {
      agentId: string;
      language: "powershell";
      scriptText: string;
      args?: string[];
      env?: Record<string, string>;
      timeoutSec?: number;
    },
  ) {
    this.checkAdmin(key);
    try {
      const job = await this.jobs.createRunScriptJob(body);
      return job;
    } catch (e: any) {
      this.logger.error(`run-script failed: ${e?.message ?? e}`, e?.stack ?? undefined);
      throw e;
    }
  }

  @Get("/jobs/:id")
  async getJob(@Headers("x-admin-api-key") key: string | undefined, @Param("id") id: string) {
    this.checkAdmin(key);
    return this.jobs.getJobWithResult(id);
  }
}
