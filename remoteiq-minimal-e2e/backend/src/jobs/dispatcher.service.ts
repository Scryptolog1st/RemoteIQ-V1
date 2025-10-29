import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import { SocketRegistry } from "../common/socket-registry.service";
import { JobsService } from "./jobs.service";

type RunScriptPayload = {
  language: "powershell" | "bash";
  scriptText: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutSec?: number;
};

// safe parse for jsonb | text
function parsePayload(raw: unknown): any | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  if (typeof raw === "object") return raw;
  return null;
}
function isRunScriptPayload(v: any): v is RunScriptPayload {
  return !!v &&
    (v.language === "powershell" || v.language === "bash") &&
    typeof v.scriptText === "string";
}

@Injectable()
export class DispatcherService {
  private readonly logger = new Logger("Dispatcher");

  constructor(
    private readonly pg: PgPoolService,
    private readonly sockets: SocketRegistry,
    @Inject(forwardRef(() => JobsService)) private readonly jobs: JobsService,
  ) { }

  /** Try to dispatch a specific queued job to its agent over WS */
  async tryDispatch(jobId: string) {
    // Load job
    const { rows } = await this.pg.query<{
      id: string;
      agent_id: string | number;
      payload: unknown;
      status: string;
    }>(
      `SELECT id, agent_id, payload, status
         FROM jobs
        WHERE id = $1
        LIMIT 1`,
      [jobId],
    );
    const job = rows[0];
    if (!job) return;

    // Always coerce the agent key to string for the registry
    const agentKey = String(job.agent_id);

    // Require socket
    const socket = this.sockets.getByAgent(agentKey);
    if (!socket || (socket as any).readyState !== 1 /* OPEN */) {
      this.logger.debug(`Agent ${agentKey} not connected; job ${job.id} stays queued`);
      return;
    }

    // Parse payload (jsonb object or text JSON)
    const parsed = parsePayload(job.payload);
    if (!isRunScriptPayload(parsed)) {
      this.logger.warn(`Invalid payload JSON for job ${job.id}; marking failed`);
      await this.jobs.finishJob(
        job.id,
        { exitCode: -1, stdout: "", stderr: "Invalid payload JSON", durationMs: 0 },
        "failed",
      );
      return;
    }

    // Send over WS
    try {
      socket.send(
        JSON.stringify({
          t: "job_run_script",
          jobId: job.id,
          language: parsed.language,
          scriptText: parsed.scriptText,
          args: parsed.args ?? [],
          env: parsed.env ?? {},
          timeoutSec: parsed.timeoutSec ?? 120,
        }),
      );
      await this.jobs.markDispatched(job.id);
    } catch (e: any) {
      this.logger.warn(`WS send failed for job ${job.id}: ${e?.message ?? e}`);
    }
  }

  /** Opportunistically dispatch all queued jobs for an agent (called on connect) */
  async dispatchQueuedForAgent(agentId: string | number) {
    const agentKey = String(agentId);
    const { rows } = await this.pg.query<{ id: string }>(
      `SELECT id
         FROM jobs
        WHERE agent_id = $1 AND status = 'queued'
        ORDER BY created_at ASC`,
      [agentKey],
    );
    for (const j of rows) {
      await this.tryDispatch(j.id);
    }
  }
}
