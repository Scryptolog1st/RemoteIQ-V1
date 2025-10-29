// backend/src/jobs/jobs.service.ts
import { Injectable, NotFoundException, Logger, Inject, forwardRef } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import { DispatcherService } from "./dispatcher.service";

type RunScriptInput = {
  agentId: string;
  language: "powershell" | "bash";
  scriptText: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutSec?: number;
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger("JobsService");

  constructor(
    private readonly pg: PgPoolService,
    @Inject(forwardRef(() => DispatcherService)) private readonly dispatcher: DispatcherService,
  ) { }

  /** Create a run-script job in SQL and attempt dispatch */
  async createRunScriptJob(input: RunScriptInput) {
    // Ensure agent exists
    const { rows: agentRows } = await this.pg.query<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 LIMIT 1`,
      [input.agentId],
    );
    if (!agentRows[0]) throw new NotFoundException("Agent not found");

    // Insert job
    const payload = JSON.stringify({
      language: input.language,
      scriptText: input.scriptText,
      args: input.args ?? [],
      env: input.env ?? {},
      timeoutSec: input.timeoutSec ?? 120,
    });

    const { rows } = await this.pg.query<{
      id: string;
      agent_id: string;
      type: string;
      status: string;
      created_at: string;
    }>(
      `INSERT INTO jobs (agent_id, type, payload, status, created_at)
       VALUES ($1, 'RUN_SCRIPT', $2, 'queued', now())
       RETURNING id, agent_id, type, status, created_at`,
      [input.agentId, payload],
    );

    const job = rows[0];

    // Fire-and-forget dispatch
    this.dispatcher.tryDispatch(job.id).catch((e: any) => {
      this.logger.warn(`Dispatch failed for job ${job.id}: ${e?.message ?? e}`);
    });

    return job;
  }

  /** Read a job and its (optional) result */
  async getJobWithResult(jobId: string) {
    const { rows } = await this.pg.query<any>(
      `SELECT
          j.id,
          j.agent_id,
          j.type,
          j.status,
          j.payload,
          j.created_at,
          j.dispatched_at,
          j.started_at,
          j.finished_at,
          r.exit_code,
          r.stdout,
          r.stderr,
          r.duration_ms
        FROM jobs j
        LEFT JOIN job_results r ON r.job_id = j.id
       WHERE j.id = $1
       LIMIT 1`,
      [jobId],
    );
    const job = rows[0];
    if (!job) throw new NotFoundException("Job not found");
    return job;
  }

  async markDispatched(jobId: string) {
    await this.pg.query(`UPDATE jobs SET status = 'dispatched', dispatched_at = now() WHERE id = $1`, [jobId]);
  }

  async markRunning(jobId: string) {
    await this.pg.query(`UPDATE jobs SET status = 'running', started_at = now() WHERE id = $1`, [jobId]);
  }

  async finishJob(
    jobId: string,
    result: { exitCode: number; stdout: string; stderr: string; durationMs: number },
    status: "succeeded" | "failed" | "timeout",
  ) {
    // Transaction: update job + insert result
    const client = (this.pg as any).ensurePool ? (this.pg as any).ensurePool() : null;
    const pool = client || (this.pg as any).pool || (this.pg as any);
    const conn = await pool.connect();

    try {
      await conn.query("BEGIN");
      await conn.query(`UPDATE jobs SET status = $1, finished_at = now() WHERE id = $2`, [status, jobId]);
      await conn.query(
        `INSERT INTO job_results (job_id, exit_code, stdout, stderr, duration_ms)
         VALUES ($1, $2, $3, $4, $5)`,
        [jobId, result.exitCode, result.stdout, result.stderr, result.durationMs],
      );
      await conn.query("COMMIT");
    } catch (e) {
      await conn.query("ROLLBACK");
      throw e;
    } finally {
      conn.release();
    }
  }
}
