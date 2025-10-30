//C:\Users\Last Stop\Documents\Programming Projects\RemoteIQ V6\remoteiq-minimal-e2e\backend\src\agents\agents.controller.ts

import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
// ^ existing service you already use for enroll
import { EnrollAgentDto } from './dto/enroll-agent.dto';
import { AgentsService } from './agents.service';
import { AgentTokenGuard, getAgentFromRequest } from '../common/agent-token.util';
import { UpdateAgentFactsDto } from './dto/update-agent-facts.dto';
import { SubmitSoftwareDto } from './dto/submit-software.dto';
import { ChecksService } from '../checks/checks.service';
import { IsArray, IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

/* ----------------------------- DTOs for runs ----------------------------- */

export enum AgentRunStatus {
  OK = 'OK',
  PASS = 'PASS',
  PASSING = 'PASSING',
  WARN = 'WARN',
  WARNING = 'WARNING',
  CRIT = 'CRIT',
  ERROR = 'ERROR',
  FAIL = 'FAIL',
  FAILING = 'FAILING',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export class SubmitCheckRunItemDto {
  /** Optional: if agent already knows the assignment id */
  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  /** Optional: used for dedupe/correlation at assignment level (stored in check_assignments.dedupe_key) */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  dedupeKey?: string;

  /** Required when assignmentId is not provided: which check the run refers to */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  checkType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  checkName?: string;

  /** Run status from agent; will be normalized server-side */
  @IsString()
  status!: string;

  /** Optional explicit severity computed by agent (WARN|CRIT); server may override */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  severity?: 'WARN' | 'CRIT';

  /** Key-value metrics (number/string/bool) */
  @IsOptional()
  @IsObject()
  metrics?: Record<string, any>;

  /** Human-readable output; server clamps length to protect DB/UI */
  @IsOptional()
  @IsString()
  @MaxLength(200000) // guard the validator; actual clamp occurs server-side too
  output?: string;

  /** Timestamps (ISO). If missing, server fills in. */
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  finishedAt?: string;
}

export class SubmitCheckRunsDto {
  /** Device that produced these runs. Must match agent->device binding if present. */
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  /** One or more runs */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitCheckRunItemDto)
  runs!: SubmitCheckRunItemDto[];
}

/* ----------------------------- Rate limiter ------------------------------ */
/** Simple in-process sliding window limiter per agent. For multi-node, replace with Redis. */
const rlWindowMs = 10_000;     // 10s
const rlMaxRequests = 20;      // 20 requests per 10s per agent
const rlState = new Map<string, number[]>();

function checkRate(agentId: string) {
  const now = Date.now();
  const arr = rlState.get(agentId) ?? [];
  const fresh = arr.filter(ts => now - ts < rlWindowMs);
  fresh.push(now);
  rlState.set(agentId, fresh);
  if (fresh.length > rlMaxRequests) {
    throw new ForbiddenException('Agent is sending check data too fast; back off and retry later.');
  }
}

/* --------------------------------- Controller ---------------------------- */

@Controller('/api/agent')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
export class AgentsController {
  constructor(
    private readonly auth: AuthService,
    private readonly agents: AgentsService,
    private readonly checks: ChecksService,
  ) { }

  /**
   * Enroll the agent and RETURN deviceId as well so the agent can persist it.
   * We normalize various possible shapes from AuthService to a clean object.
   */
  @Post('/enroll')
  async enroll(
    @Body() body: EnrollAgentDto
  ): Promise<{ agentId: string; deviceId: string; agentToken: string }> {
    const res: any = await this.auth.enrollAgent(body);

    const agentId =
      String(res?.agentId ?? res?.agent?.id ?? '');
    const deviceId =
      String(res?.deviceId ?? res?.device?.id ?? body?.deviceId ?? '');
    const agentToken =
      String(res?.agentToken ?? res?.token ?? res?.accessToken ?? '');

    if (!agentToken || !agentId) {
      throw new Error('Enrollment succeeded but missing token or agentId in response.');
    }

    return { agentId, deviceId, agentToken };
  }

  /** Authenticated ping: updates last_seen_at + facts */
  @Post('/ping')
  @UseGuards(AgentTokenGuard)
  async ping(@Req() req: any, @Body() body: UpdateAgentFactsDto) {
    const agent = getAgentFromRequest(req);
    await this.agents.updateFacts(agent.id, body ?? {});
    return { ok: true };
  }

  /** Authenticated: submit full software inventory */
  @Post('/software')
  @UseGuards(AgentTokenGuard)
  async submitSoftware(@Req() req: any, @Body() body: SubmitSoftwareDto) {
    const agent = getAgentFromRequest(req);
    await this.agents.upsertSoftware(agent.id, body?.items ?? []);
    return { ok: true, count: body?.items?.length ?? 0 };
  }

  /* ===================== NEW: Check runs ingestion ====================== */

  /**
   * Agent pushes one or many check runs.
   * - Validates token→agent and device binding
   * - Upserts check + assignment
   * - Inserts check_runs
   * - Optionally broadcasts a WS event for UI (done in service)
   */
  @Post('/check-runs')
  @UseGuards(AgentTokenGuard)
  async submitCheckRuns(@Req() req: any, @Body() body: SubmitCheckRunsDto) {
    const agent = getAgentFromRequest(req); // { id, deviceId? }
    checkRate(agent.id);

    const deviceIdFromToken: string | undefined =
      agent.deviceId ? String(agent.deviceId) : undefined;

    const deviceIdFromBody: string | undefined =
      body?.deviceId ? String(body.deviceId) : undefined;

    const deviceId = deviceIdFromBody ?? deviceIdFromToken;

    if (!deviceId) {
      throw new BadRequestException('deviceId is required (bind agent to device first).');
    }
    if (deviceIdFromBody && deviceIdFromToken && deviceIdFromBody !== deviceIdFromToken) {
      throw new ForbiddenException('deviceId in body does not match the agent binding.');
    }
    if (!Array.isArray(body?.runs) || body.runs.length === 0) {
      throw new BadRequestException('runs is required and must be a non-empty array');
    }

    const result = await this.checks.ingestAgentRuns({
      agentId: String(agent.id),
      deviceId: deviceId,
      runs: body.runs.map(r => ({
        assignmentId: r.assignmentId,
        dedupeKey: r.dedupeKey,
        checkType: r.checkType,
        checkName: r.checkName,
        status: r.status,
        severity: r.severity,
        metrics: r.metrics,
        output: r.output,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
      })),
    });

    return { ok: true, inserted: result.inserted, assignmentsCreated: result.assignmentsCreated };
  }

  /* ============== NEW (optional): Pull assignments for device =========== */

  /**
   * Returns checks server expects the agent to evaluate for the given device.
   * This enables server-driven checks. Safe to call even if none exist.
   */
  @Get('/assignments')
  @UseGuards(AgentTokenGuard)
  async getAssignments(@Req() req: any, @Query('deviceId') deviceId?: string) {
    const agent = getAgentFromRequest(req);
    const effective = deviceId ?? agent.deviceId;
    if (!effective) {
      throw new BadRequestException('deviceId is required (either query param or bound to agent).');
    }
    const { items } = await this.checks.getAssignmentsForDevice(effective);
    return { items };
  }
}
