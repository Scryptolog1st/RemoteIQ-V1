<# 
  scaffold-remoteiq-fixed3.ps1
  Creates the minimal RemoteIQ E2E (NestJS backend + Windows .NET 8 agent + WiX MSI packaging).
  Fixes: JSON-string payload, removes @db.Text for SQLite, and corrects here-strings.
#>

param(
  [string]$Root = "remoteiq-minimal-e2e"
)

$ErrorActionPreference = "Stop"

function Write-File {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $normalized = $Content -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText($Path, $normalized, (New-Object System.Text.UTF8Encoding($false)))
}

function Section { param([string]$Text) ; Write-Host ("`n=== {0} ===" -f $Text) -ForegroundColor Cyan }

Section "Creating folders"
$paths = @(
  "$Root/backend/prisma",
  "$Root/backend/src/common",
  "$Root/backend/src/auth",
  "$Root/backend/src/agents",
  "$Root/backend/src/jobs",
  "$Root/backend/src/ws",
  "$Root/agent-windows/RemoteIQ.Agent/Models",
  "$Root/agent-windows/RemoteIQ.Agent/Services",
  "$Root/agent-windows/RemoteIQ.Agent/Util",
  "$Root/agent-windows/packaging"
)
foreach ($p in $paths) { New-Item -ItemType Directory -Force -Path $p | Out-Null }

Section "Writing backend files"

Write-File "$Root/backend/package.json" @'
{
  "name": "remoteiq-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "start": "node dist/main.js",
    "build": "tsc -p tsconfig.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev --name init",
    "prisma:studio": "prisma studio",
    "health": "curl -sf http://localhost:${PORT:-3001}/healthz && echo OK || (echo FAIL; exit 1)"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.6",
    "@nestjs/core": "^10.3.6",
    "@nestjs/platform-express": "^10.3.6",
    "@nestjs/websockets": "^10.3.6",
    "@prisma/client": "^5.19.0",
    "cookie-parser": "^1.4.6",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "rxjs": "^7.8.1",
    "ws": "^8.18.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.11.30",
    "prisma": "^5.19.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3"
  }
}
'@

Write-File "$Root/backend/tsconfig.json" @'
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2022",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
'@

# FIXED: here-string must start on a new line with no trailing chars
Write-File "$Root/backend/nest-cli.json" @'
{ "collection": "@nestjs/schematics", "sourceRoot": "src" }
'@

Write-File "$Root/backend/.env.example" @'
NODE_ENV=development
PORT=3001
DATABASE_URL="file:./dev.db"
ENROLLMENT_SECRET="replace-me"
ADMIN_API_KEY="replace-me"
JWT_SECRET="replace-me"
'@

# prisma/schema.prisma (SQLite-safe)
Write-File "$Root/backend/prisma/schema.prisma" @'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Agent {
  id              String   @id @default(uuid())
  deviceId        String
  hostname        String
  os              String
  arch            String
  version         String
  enrolledAt      DateTime @default(now())
  lastHeartbeatAt DateTime?
  tokenHash       String

  jobs Job[]
  @@index([deviceId])
}

model Job {
  id           String    @id @default(uuid())
  agentId      String
  type         String    // "RUN_SCRIPT"
  payload      String    // JSON string (SQLite-safe)
  status       String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  dispatchedAt DateTime?
  startedAt    DateTime?
  finishedAt   DateTime?

  agent        Agent     @relation(fields: [agentId], references: [id])
  result       JobResult?

  @@index([agentId, status])
}

model JobResult {
  id         String   @id @default(uuid())
  jobId      String   @unique
  exitCode   Int
  stdout     String
  stderr     String
  durationMs Int
  createdAt  DateTime @default(now())

  job        Job      @relation(fields: [jobId], references: [id])
}
'@

Write-File "$Root/backend/src/common/types.ts" @'
export type WSAgentHello = {
  t: "hello";
  agentId: string;
  capabilities: string[];
  os: string;
  arch: string;
  hostname: string;
  version: string;
};

export type WSHeartbeat = {
  t: "hb";
  at: string;
  metrics?: { cpu?: number; mem?: number };
};

export type WSJobRunScript = {
  t: "job_run_script";
  jobId: string;
  language: "powershell" | "bash";
  scriptText: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutSec?: number;
};

export type WSJobResult = {
  t: "job_result";
  jobId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
};

export type WSOutgoing = WSJobRunScript | { t: "ack"; id: string };
export type WSIncoming = WSAgentHello | WSHeartbeat | WSJobResult;
'@

Write-File "$Root/backend/src/common/admin-api.guard.ts" @'
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AdminApiGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.header("x-admin-api-key");
    const expected = process.env.ADMIN_API_KEY || "";
    if (!expected || key !== expected) {
      throw new UnauthorizedException("Invalid or missing x-admin-api-key");
    }
    return true;
  }
}
'@

Write-File "$Root/backend/src/common/agent-token.util.ts" @'
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const algo = "sha256";

export function hashToken(token: string): string {
  return crypto.createHash(algo).update(token, "utf8").digest("hex");
}

export function newOpaqueToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function signAgentJwt(agentId: string): string {
  const secret = process.env.JWT_SECRET || "dev";
  return jwt.sign({ sub: agentId, typ: "agent" }, secret, { algorithm: "HS256" });
}

export function verifyAgentJwt(token: string): string | null {
  try {
    const secret = process.env.JWT_SECRET || "dev";
    const payload = jwt.verify(token, secret) as any;
    return payload?.sub as string;
  } catch {
    return null;
  }
}
'@

Write-File "$Root/backend/src/common/prisma.service.ts" @'
import { INestApplication, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
  async enableShutdownHooks(app: INestApplication) {
    this.$on("beforeExit", async () => {
      await app.close();
    });
  }
}
'@

Write-File "$Root/backend/src/auth/auth.module.ts" @'
import { Module } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AuthService } from "./auth.service";

@Module({
  providers: [PrismaService, AuthService],
  exports: [AuthService]
})
export class AuthModule {}
'@

Write-File "$Root/backend/src/auth/auth.service.ts" @'
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { hashToken, newOpaqueToken, signAgentJwt } from "../common/agent-token.util";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async enrollAgent(input: {
    enrollmentSecret: string;
    deviceId: string;
    hostname: string;
    os: string;
    arch: string;
    version: string;
  }) {
    const expected = process.env.ENROLLMENT_SECRET || "";
    if (!expected || input.enrollmentSecret !== expected) {
      throw new UnauthorizedException("Invalid enrollment secret");
    }
    const token = newOpaqueToken();
    const tokenHash = hashToken(token);

    const agent = await this.prisma.agent.create({
      data: {
        deviceId: input.deviceId,
        hostname: input.hostname,
        os: input.os,
        arch: input.arch,
        version: input.version,
        tokenHash
      }
    });

    return { agentId: agent.id, agentToken: token };
  }

  async validateAgentToken(rawToken: string): Promise<string | null> {
    const hash = hashToken(rawToken);
    const found = await this.prisma.agent.findFirst({ where: { tokenHash: hash } });
    return found?.id ?? null;
  }

  signJwt(agentId: string) { return signAgentJwt(agentId); }
}
'@

Write-File "$Root/backend/src/agents/agents.module.ts" @'
import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { PrismaService } from "../common/prisma.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AgentsController],
  providers: [PrismaService]
})
export class AgentsModule {}
'@

Write-File "$Root/backend/src/agents/agents.controller.ts" @'
import { Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";

const EnrollSchema = z.object({
  enrollmentSecret: z.string(),
  deviceId: z.string(),
  hostname: z.string(),
  os: z.string(),
  arch: z.string(),
  version: z.string()
});

@Controller("/api/agent")
export class AgentsController {
  constructor(private auth: AuthService) {}

  @Post("/enroll")
  async enroll(@Body() body: unknown) {
    const input = EnrollSchema.parse(body);
    return this.auth.enrollAgent(input);
  }
}
'@

Write-File "$Root/backend/src/jobs/jobs.module.ts" @'
import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { DispatcherService } from "./dispatcher.service";
import { PrismaService } from "../common/prisma.service";

@Module({
  controllers: [JobsController],
  providers: [JobsService, DispatcherService, PrismaService],
  exports: [DispatcherService, JobsService]
})
export class JobsModule {}
'@

Write-File "$Root/backend/src/jobs/jobs.controller.ts" @'
import { Controller, Get, Post, Param, Body, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../common/admin-api.guard";
import { JobsService } from "./jobs.service";
import { z } from "zod";
import { PrismaService } from "../common/prisma.service";

const RunScriptSchema = z.object({
  agentId: z.string().uuid(),
  language: z.literal("powershell"),
  scriptText: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  timeoutSec: z.number().int().positive().max(3600).optional()
});

@Controller("/api/admin")
@UseGuards(AdminApiGuard)
export class JobsController {
  constructor(private jobs: JobsService, private prisma: PrismaService) {}

  @Post("/agents")
  async listAgents() {
    const agents = await this.prisma.agent.findMany({
      orderBy: { enrolledAt: "desc" }
    });
    return { items: agents };
  }

  @Post("/jobs/run-script")
  async createRunScript(@Body() body: unknown) {
    const input = RunScriptSchema.parse(body);
    return this.jobs.createRunScriptJob(input);
  }

  @Get("/jobs/:id")
  async getJob(@Param("id") id: string) {
    return this.jobs.getJobWithResult(id);
  }
}
'@

Write-File "$Root/backend/src/jobs/jobs.service.ts" @'
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { DispatcherService } from "./dispatcher.service";

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService, private dispatcher: DispatcherService) {}

  async createRunScriptJob(input: {
    agentId: string;
    language: "powershell";
    scriptText: string;
    args?: string[];
    env?: Record<string, string>;
    timeoutSec?: number;
  }) {
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
          timeoutSec: input.timeoutSec ?? 120
        }),
        status: "queued"
      }
    });

    await this.dispatcher.tryDispatch(job.id);
    return job;
  }

  async getJobWithResult(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { result: true }
    });
    if (!job) throw new NotFoundException("Job not found");
    return job;
  }

  async markDispatched(jobId: string) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: "dispatched", dispatchedAt: new Date() }
    });
  }

  async markRunning(jobId: string) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date() }
    });
  }

  async finishJob(jobId: string, result: {
    exitCode: number; stdout: string; stderr: string; durationMs: number;
  }, status: "succeeded" | "failed" | "timeout") {
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: jobId },
        data: { status, finishedAt: new Date() }
      }),
      this.prisma.jobResult.create({
        data: {
          jobId,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: result.durationMs
        }
      })
    ]);
  }
}
'@

Write-File "$Root/backend/src/jobs/dispatcher.service.ts" @'
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AgentGateway } from "../ws/agent.gateway";
import { JobsService } from "./jobs.service";

@Injectable()
export class DispatcherService {
  private readonly logger = new Logger("Dispatcher");
  constructor(
    private prisma: PrismaService,
    private ws: AgentGateway,
    private jobs: JobsService
  ) {}

  async tryDispatch(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;

    const socket = this.ws.getSocket(job.agentId);
    if (!socket) {
      this.logger.debug(`Agent ${job.agentId} not connected; job ${job.id} stays queued`);
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(job.payload as unknown as string);
    } catch (e) {
      this.logger.error(`Failed to parse job ${job.id} payload: ${(e as Error).message}`);
      return;
    }

    socket.send(JSON.stringify({
      t: "job_run_script",
      jobId: job.id,
      language: payload.language,
      scriptText: payload.scriptText,
      args: payload.args ?? [],
      env: payload.env ?? {},
      timeoutSec: payload.timeoutSec ?? 120
    }));

    await this.jobs.markDispatched(job.id);
  }

  async dispatchQueuedForAgent(agentId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { agentId, status: "queued" },
      orderBy: { createdAt: "asc" }
    });
    for (const j of jobs) await this.tryDispatch(j.id);
  }
}
'@

Write-File "$Root/backend/src/ws/ws.module.ts" @'
import { Module } from "@nestjs/common";
import { AgentGateway } from "./agent.gateway";
import { PrismaService } from "../common/prisma.service";
import { JobsModule } from "../jobs/jobs.module";

@Module({
  imports: [JobsModule],
  providers: [AgentGateway, PrismaService],
  exports: [AgentGateway]
})
export class WsModule {}
'@

Write-File "$Root/backend/src/ws/agent.gateway.ts" @'
import { Logger } from "@nestjs/common";
import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from "@nestjs/websockets";
import { Server, WebSocket } from "ws";
import { PrismaService } from "../common/prisma.service";
import { DispatcherService } from "../jobs/dispatcher.service";
import { JobsService } from "../jobs/jobs.service";
import { WSIncoming } from "../common/types";

type SocketWithMeta = WebSocket & { agentId?: string };

@WebSocketGateway({ path: "/ws/agent" })
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger("AgentGateway");
  private socketsByAgent = new Map<string, SocketWithMeta>();

  constructor(
    private prisma: PrismaService,
    private dispatcher: DispatcherService,
    private jobs: JobsService
  ) {}

  getSocket(agentId: string): SocketWithMeta | undefined {
    return this.socketsByAgent.get(agentId);
  }

  async handleConnection(socket: SocketWithMeta, req: any) {
    const auth = req.headers["authorization"] as string | undefined;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;

    if (!token) {
      this.logger.warn("WS connection missing Authorization");
      socket.close(1008, "Missing Authorization");
      return;
    }

    const crypto = await import("node:crypto");
    const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
    const agent = await this.prisma.agent.findFirst({ where: { tokenHash } });
    if (!agent) {
      this.logger.warn("WS invalid token");
      socket.close(1008, "Invalid token");
      return;
    }

    socket.agentId = agent.id;
    this.socketsByAgent.set(agent.id, socket);
    this.logger.log(`Agent connected: ${agent.id} (${agent.hostname})`);

    socket.on("message", (data: Buffer) => this.onMessage(socket, data));
    socket.on("close", () => this.onClose(socket));
    await this.dispatcher.dispatchQueuedForAgent(agent.id);
  }

  async handleDisconnect(socket: SocketWithMeta) {
    this.onClose(socket);
  }

  private async onClose(socket: SocketWithMeta) {
    if (socket.agentId) {
      this.socketsByAgent.delete(socket.agentId);
      this.logger.log(`Agent disconnected: ${socket.agentId}`);
    }
  }

  private async onMessage(socket: SocketWithMeta, data: Buffer) {
    try {
      const msg = JSON.parse(data.toString("utf8")) as WSIncoming;
      if (msg.t === "hello") {
        await this.prisma.agent.update({
          where: { id: msg.agentId },
          data: { lastHeartbeatAt: new Date(), hostname: msg.hostname, os: msg.os, arch: msg.arch, version: msg.version }
        });
        socket.send(JSON.stringify({ t: "ack", id: "hello" }));
        this.logger.debug(`hello from ${msg.agentId}`);
      } else if (msg.t === "hb") {
        if (socket.agentId) {
          await this.prisma.agent.update({ where: { id: socket.agentId }, data: { lastHeartbeatAt: new Date() } });
        }
      } else if (msg.t === "job_result") {
        const started = new Date(msg.startedAt);
        const finished = new Date(msg.finishedAt);
        const dur = Math.max(0, finished.getTime() - started.getTime());
        const status = msg.exitCode === 0 ? "succeeded" : "failed";
        await this.jobs.finishJob(msg.jobId, {
          exitCode: msg.exitCode,
          stdout: limit1MB(msg.stdout),
          stderr: limit1MB(msg.stderr),
          durationMs: dur
        }, status);
      }
    } catch (e) {
      this.logger.error(`WS message parse error: ${(e as Error).message}`);
    }
  }
}

function limit1MB(s: string): string {
  const MAX = 1_000_000;
  if (s.length <= MAX) return s;
  return s.slice(0, MAX) + `\n[truncated ${s.length - MAX} bytes]`;
}
'@

Write-File "$Root/backend/src/app.module.ts" @'
import { Module } from "@nestjs/common";
import { AgentsModule } from "./agents/agents.module";
import { JobsModule } from "./jobs/jobs.module";
import { WsModule } from "./ws/ws.module";

@Module({ imports: [AgentsModule, JobsModule, WsModule] })
export class AppModule {}
'@

Write-File "$Root/backend/src/main.ts" @'
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import cookieParser from "cookie-parser";
import express from "express";
import { PrismaService } from "./common/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["log", "error", "warn", "debug"] });
  const port = Number(process.env.PORT || 3001);

  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  const prisma = app.get(PrismaService);
  await prisma.$connect();
  app.getHttpAdapter().getInstance().get("/healthz", (_: any, res: any) => res.status(200).send("OK"));

  await app.listen(port);
}
bootstrap();
'@

Section "Agent files"

Write-File "$Root/agent-windows/RemoteIQ.Agent/RemoteIQ.Agent.csproj" @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <PublishSingleFile>true</PublishSingleFile>
    <PublishTrimmed>true</PublishTrimmed>
    <InvariantGlobalization>true</InvariantGlobalization>
    <AssemblyName>RemoteIQ.Agent</AssemblyName>
  </PropertyGroup>
</Project>
'@

Write-File "$Root/agent-windows/RemoteIQ.Agent/Program.cs" @'
using System.Text.Json;
using RemoteIQ.Agent.Models;
using RemoteIQ.Agent.Services;

static string DataDir() => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RemoteIQ");
static string CfgPath() => Path.Combine(DataDir(), "agent.json");

Console.WriteLine("RemoteIQ Windows Agent (minimal) starting...");
Logger.Info("Agent starting");

string baseUrl = Environment.GetEnvironmentVariable("REMOTEIQ_URL") ?? "http://localhost:3001";
string enrollSecret = Environment.GetEnvironmentVariable("ENROLLMENT_SECRET") ?? "";

Directory.CreateDirectory(DataDir());

AgentConfig? cfg = null;
if (File.Exists(CfgPath()))
{
    var json = await File.ReadAllTextAsync(CfgPath());
    cfg = JsonSerializer.Deserialize<AgentConfig>(json);
}

if (cfg == null)
{
    if (string.IsNullOrWhiteSpace(enrollSecret))
    {
        Console.WriteLine("ENROLLMENT_SECRET env var is required on first run.");
        Logger.Error("Missing ENROLLMENT_SECRET");
        return 1;
    }
    var client = new EnrollmentClient(baseUrl);
    var enrolled = await client.EnrollAsync(enrollSecret);
    if (enrolled == null)
    {
        Console.WriteLine("Enrollment failed. See log.");
        return 1;
    }
    cfg = enrolled;
    await File.WriteAllTextAsync(CfgPath(), JsonSerializer.Serialize(cfg));
    Console.WriteLine($"Enrolled: {cfg.AgentId}");
    Logger.Info($"Enrolled agent {cfg.AgentId}");
}

using var ws = new WebSocketClient(baseUrl, cfg);
await ws.RunAsync();
return 0;
'@

Write-File "$Root/agent-windows/RemoteIQ.Agent/Models/AgentConfig.cs" @'
namespace RemoteIQ.Agent.Models;

public class AgentConfig
{
    public string AgentId { get; set; } = "";
    public string AgentToken { get; set; } = "";
}
'@

Write-File "$Root/agent-windows/RemoteIQ.Agent/Services/Logger.cs" @'
using System.IO;

namespace RemoteIQ.Agent.Services;

public static class Logger
{
    private static readonly object _lock = new();
    private static readonly string LogDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RemoteIQ");
    private static readonly string LogFile = Path.Combine(LogDir, "agent.log");

    public static void Info(string msg) => Write("INFO", msg);
    public static void Warn(string msg) => Write("WARN", msg);
    public static void Error(string msg) => Write("ERROR", msg);

    private static void Write(string level, string msg)
    {
        lock (_lock)
        {
            Directory.CreateDirectory(LogDir);
            File.AppendAllText(LogFile, $"{DateTime.UtcNow:o} [{level}] {msg}\n");
        }
    }
}
'@

Write-File "$Root/agent-windows/RemoteIQ.Agent/Util/Json.cs" @'
using System.Text.Json;

namespace RemoteIQ.Agent.Util;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public static string Stringify<T>(T obj) => JsonSerializer.Serialize(obj, Options);
    public static T Parse<T>(string s) => JsonSerializer.Deserialize<T>(s, Options)!;
}
'@

Write-File "$Root/agent-windows/RemoteIQ.Agent/Services/EnrollmentClient.cs" @'
using System.Net.Http;
using System.Net.Http.Json;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services;

public class EnrollmentClient
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;

    public EnrollmentClient(string baseUrl)
    {
        _http = new HttpClient();
        _baseUrl = baseUrl.TrimEnd('/');
    }

    public record EnrollReq(string EnrollmentSecret, string DeviceId, string Hostname, string Os, string Arch, string Version);
    public record EnrollResp(string AgentId, string AgentToken);

    public async Task<AgentConfig?> EnrollAsync(string enrollmentSecret)
    {
        var req = new EnrollReq(
            enrollmentSecret,
            deviceId: Guid.NewGuid().ToString(),
            hostname: Environment.MachineName,
            os: "windows",
            arch: Environment.Is64BitProcess ? "x64" : "x86",
            version: "0.1.0"
        );

        var resp = await _http.PostAsJsonAsync($"{_baseUrl}/api/agent/enroll", req);
        if (!resp.IsSuccessStatusCode) return null;
        var data = await resp.Content.ReadFromJsonAsync<EnrollResp>();
        if (data == null) return null;
        return new AgentConfig { AgentId = data.AgentId, AgentToken = data.AgentToken };
    }
}
'@

Write-File "$Root/agent-windows/RemoteIQ.Agent/Services/ScriptRunner.cs" @'
using System.Diagnostics;
using System.Text;

namespace RemoteIQ.Agent.Services;

public static class ScriptRunner
{
    public static async Task<(int exitCode, string stdout, string stderr, int durationMs)> RunPowerShellAsync(
        string scriptText, string[]? args, Dictionary<string, string>? env, int timeoutSec)
    {
        string tempPath = Path.Combine(Path.GetTempPath(), $"riq_{Guid.NewGuid():N}.ps1");
        await File.WriteAllTextAsync(tempPath, scriptText, new UTF8Encoding(false));

        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{tempPath}\" {(args != null ? string.Join(" ", args.Select(a => EscapeArg(a))) : "")}",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        if (env != null)
            foreach (var kv in env) psi.Environment[kv.Key] = kv.Value;

        var sw = Stopwatch.StartNew();
        var p = new Process { StartInfo = psi };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        p.OutputDataReceived += (_, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };
        p.ErrorDataReceived += (_, e) => { if (e.Data != null) stderr.AppendLine(e.Data); };

        p.Start();
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSec));
        try
        {
            await Task.Run(() => p.WaitForExit(), cts.Token);
        }
        catch (OperationCanceledException)
        {
            try { p.Kill(entireProcessTree: true); } catch { }
            return (124, "", "timeout", (int)sw.ElapsedMilliseconds);
        }
        finally
        {
            try { File.Delete(tempPath); } catch { }
        }

        var code = p.ExitCode;
        var outStr = Trunc1MB(stdout.ToString());
        var errStr = Trunc1MB(stderr.ToString());
        return (code, outStr, errStr, (int)sw.ElapsedMilliseconds);
    }

    private static string EscapeArg(string a) => a.Contains(' ') ? $"\"{a.Replace("\"", "\\\"")}\"" : a;

    private static string Trunc1MB(string s)
    {
        const int MAX = 1_000_000;
        if (s.Length <= MAX) return s;
        return s[..MAX] + $"\n[truncated {s.Length - MAX} bytes]";
    }
}
'@

Write-File "$Root/agent-windows/RemoteIQ.Agent/Services/WebSocketClient.cs" @'
using System.Net.WebSockets;
using System.Text;
using RemoteIQ.Agent.Models;
using RemoteIQ.Agent.Util;

namespace RemoteIQ.Agent.Services;

public class WebSocketClient : IDisposable
{
    private readonly Uri _uri;
    private readonly string _token;
    private readonly AgentConfig _cfg;
    private ClientWebSocket? _ws;
    private readonly CancellationTokenSource _cts = new();

    public WebSocketClient(string baseUrl, AgentConfig cfg)
    {
        var wsUrl = baseUrl.Replace("http://", "ws://").Replace("https://", "wss://").TrimEnd('/');
        _uri = new Uri($"{wsUrl}/ws/agent");
        _token = cfg.AgentToken;
        _cfg = cfg;
    }

    public async Task RunAsync()
    {
        var rand = new Random();
        int attempt = 0;

        while (!_cts.IsCancellationRequested)
        {
            try
            {
                _ws = new ClientWebSocket();
                _ws.Options.SetRequestHeader("Authorization", $"Bearer {_token}");
                await _ws.ConnectAsync(_uri, _cts.Token);
                Logger.Info("WS connected");
                attempt = 0;

                await SendAsync(new {
                    t = "hello",
                    agentId = _cfg.AgentId,
                    capabilities = new[] { "run_script" },
                    os = "windows",
                    arch = Environment.Is64BitProcess ? "x64" : "x86",
                    hostname = Environment.MachineName,
                    version = "0.1.0"
                });

                var hbTask = HeartbeatLoop();
                await ReceiveLoop();
                await hbTask;
            }
            catch (Exception ex)
            {
                Logger.Warn($"WS connection error: {ex.Message}");
            }
            finally
            {
                try { _ws?.Dispose(); } catch { }
                _ws = null;
            }

            attempt++;
            var backoff = Math.Min(30000, (int)Math.Pow(2, Math.Min(attempt, 10)) * 500);
            var jitter = rand.Next(0, 1000);
            await Task.Delay(backoff + jitter, _cts.Token);
        }
    }

    private async Task HeartbeatLoop()
    {
        while (_ws != null && _ws.State == WebSocketState.Open && !_cts.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(30), _cts.Token);
            if (_ws?.State == WebSocketState.Open)
            {
                await SendAsync(new { t = "hb", at = DateTime.UtcNow.ToString("o") });
            }
        }
    }

    private async Task ReceiveLoop()
    {
        var buf = new byte[64 * 1024];
        while (_ws != null && _ws.State == WebSocketState.Open && !_cts.IsCancellationRequested)
        {
            var ms = new MemoryStream();
            WebSocketReceiveResult? result;
            do
            {
                result = await _ws.ReceiveAsync(new ArraySegment<byte>(buf), _cts.Token);
                if (result.MessageType == WebSocketMessageType.Close) return;
                ms.Write(buf, 0, result.Count);
            } while (!result.EndOfMessage);

            var str = Encoding.UTF8.GetString(ms.ToArray());
            await HandleMessage(str);
        }
    }

    private async Task HandleMessage(string json)
    {
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var t = doc.RootElement.GetProperty("t").GetString();
        if (t == "job_run_script")
        {
            var jobId = doc.RootElement.GetProperty("jobId").GetString()!;
            var language = doc.RootElement.GetProperty("language").GetString()!;
            if (language != "powershell")
            {
                await SendAsync(new {
                    t = "job_result",
                    jobId,
                    exitCode = 2,
                    stdout = "",
                    stderr = "Unsupported language in minimal agent",
                    startedAt = DateTime.UtcNow.ToString("o"),
                    finishedAt = DateTime.UtcNow.ToString("o")
                });
                return;
            }
            var scriptText = doc.RootElement.GetProperty("scriptText").GetString()!;
            var args = doc.RootElement.TryGetProperty("args", out var aEl) && aEl.ValueKind == System.Text.Json.JsonValueKind.Array
                ? aEl.EnumerateArray().Select(x => x.GetString() ?? "").ToArray()
                : Array.Empty<string>();
            var env = new Dictionary<string, string>();
            if (doc.RootElement.TryGetProperty("env", out var eEl) && eEl.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                foreach (var p in eEl.EnumerateObject()) env[p.Name] = p.Value.GetString() ?? "";
            }
            var timeoutSec = doc.RootElement.TryGetProperty("timeoutSec", out var toEl) ? toEl.GetInt32() : 120;

            var started = DateTime.UtcNow;
            var (code, stdout, stderr, dur) = await ScriptRunner.RunPowerShellAsync(scriptText, args, env, timeoutSec);
            var finished = DateTime.UtcNow;

            await SendAsync(new {
                t = "job_result",
                jobId,
                exitCode = code,
                stdout,
                stderr,
                startedAt = started.ToString("o"),
                finishedAt = finished.ToString("o")
            });
        }
    }

    private async Task SendAsync(object obj)
    {
        if (_ws == null || _ws.State != WebSocketState.Open) return;
        var data = Encoding.UTF8.GetBytes(RemoteIQ.Agent.Util.Json.Stringify(obj));
        await _ws.SendAsync(data, WebSocketMessageType.Text, true, _cts.Token);
    }

    public void Dispose()
    {
        _cts.Cancel();
        try { _ws?.Abort(); } catch { }
        _ws?.Dispose();
    }
}
'@

Section "Packaging"

Write-File "$Root/agent-windows/packaging/Product.wxs" @'
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" Name="RemoteIQ Agent" Language="1033" Version="0.1.0" Manufacturer="RemoteIQ"
           UpgradeCode="A7D3F2AA-6A2C-4C2C-9C9A-5C6E4D2B1F00">
    <Package InstallerVersion="500" Compressed="yes" InstallScope="perMachine" />
    <MajorUpgrade DowngradeErrorMessage="A newer version is already installed." />
    <MediaTemplate />
    <Feature Id="ProductFeature" Title="RemoteIQ Agent" Level="1">
      <ComponentGroupRef Id="AppFiles" />
    </Feature>
  </Product>

  <Fragment>
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFilesFolder">
        <Directory Id="INSTALLFOLDER" Name="RemoteIQ">
          <Directory Id="AGENTFOLDER" Name="Agent" />
        </Directory>
      </Directory>
      <Directory Id="ProgramMenuFolder">
        <Directory Id="ApplicationProgramsFolder" Name="RemoteIQ" />
      </Directory>
    </Directory>
  </Fragment>

  <Fragment>
    <ComponentGroup Id="AppFiles" Directory="AGENTFOLDER">
      <Component Id="AgentExe" Guid="*">
        <File Id="AgentExeFile" Source="$(var.PublishDir)\RemoteIQ.Agent.exe" KeyPath="yes" />
        <Shortcut Id="StartMenuShortcut"
                  Directory="ApplicationProgramsFolder"
                  Name="RemoteIQ Agent"
                  WorkingDirectory="AGENTFOLDER"
                  Icon="agent.ico"
                  Target="[AGENTFOLDER]RemoteIQ.Agent.exe" />
        <RegistryValue Root="HKLM" Key="Software\RemoteIQ\Agent" Name="InstallDir" Type="string" Value="[AGENTFOLDER]" KeyPath="yes" />
      </Component>
    </ComponentGroup>

    <Icon Id="agent.ico" SourceFile="$(var.PublishDir)\agent.ico" />
  </Fragment>
</Wix>
'@

Write-File "$Root/agent-windows/packaging/build_msi.ps1" @'
param(
  [string]$Configuration = "Release",
  [string]$Runtime = "win-x64"
)
$ErrorActionPreference = "Stop"
Push-Location "$PSScriptRoot\.."
dotnet publish .\RemoteIQ.Agent\RemoteIQ.Agent.csproj -c $Configuration -r $Runtime `
  /p:PublishSingleFile=true /p:PublishTrimmed=true `
  -o "$PSScriptRoot\publish"
Pop-Location
$publishDir = Join-Path $PSScriptRoot "publish"
$wxs = Join-Path $PSScriptRoot "Product.wxs"
$candle = Get-Command candle.exe -ErrorAction SilentlyContinue
$light = Get-Command light.exe -ErrorAction SilentlyContinue
if (-not $candle -or -not $light) { throw "WiX Toolset not found. Install WiX v3 and ensure candle.exe/light.exe are in PATH." }
$ico = Join-Path $publishDir "agent.ico"
if (-not (Test-Path $ico)) { New-Item -Path $ico -ItemType File | Out-Null }
& $candle.Path -dPublishDir="$publishDir" -o "$PSScriptRoot\Product.wixobj" $wxs
& $light.Path -o "$PSScriptRoot\RemoteIQAgent.msi" "$PSScriptRoot\Product.wixobj"
Write-Host "MSI built: $PSScriptRoot\RemoteIQAgent.msi"
'@

Write-Host "`nScaffold (fixed3) complete!" -ForegroundColor Green
Write-Host "Project root: $Root"
Write-Host "`nNEXT STEPS:" -ForegroundColor Yellow
Write-Host @"
1) Backend:
   cd $Root\backend
   copy .env.example .env   # set ENROLLMENT_SECRET, ADMIN_API_KEY, JWT_SECRET
   pnpm install
   pnpm approve-builds
   pnpm prisma:generate
   pnpm prisma:migrate:dev
   pnpm dev

2) Agent:
   setx REMOTEIQ_URL "http://localhost:3001"
   setx ENROLLMENT_SECRET "your-secret"
   cd $Root\agent-windows\RemoteIQ.Agent
   dotnet run
"@
