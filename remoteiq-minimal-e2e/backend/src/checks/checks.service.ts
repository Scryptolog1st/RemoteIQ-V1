// backend/src/checks/checks.service.ts
import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PgPoolService } from '../storage/pg-pool.service';
import { UiSocketRegistry } from '../common/ui-socket-registry.service';

/* ========================= Types / helpers ========================= */

export enum CheckScope {
    DEVICE = 'DEVICE',
    SITE = 'SITE',
    CLIENT = 'CLIENT',
    GLOBAL = 'GLOBAL',
}

export enum CheckType {
    PING = 'PING',
    CPU = 'CPU',
    MEMORY = 'MEMORY',
    DISK = 'DISK',
    SERVICE = 'SERVICE',
    PROCESS = 'PROCESS',
    PORT = 'PORT',
    WINEVENT = 'WINEVENT',
    SOFTWARE = 'SOFTWARE',
    SECURITY = 'SECURITY',
    SCRIPT = 'SCRIPT',
    PATCH = 'PATCH',
    CERT = 'CERT',
    SMART = 'SMART',
    RDP = 'RDP',
    SMB = 'SMB',
    FIREWALL = 'FIREWALL',
}

export type DeviceCheckDTO = {
    id: string; // assignment id (device-scoped)
    name: string;
    status: 'Passing' | 'Warning' | 'Failing';
    lastRun: string | null;
    output: string;
};

type NormalizedRunStatus = 'OK' | 'WARN' | 'CRIT' | 'TIMEOUT' | 'UNKNOWN';

function normalizeStatus(s?: string | null): NormalizedRunStatus {
    const t = String(s || '').trim().toUpperCase();
    if (t === 'OK' || t === 'PASS' || t === 'PASSING') return 'OK';
    if (t === 'WARN' || t === 'WARNING') return 'WARN';
    if (t === 'TIMEOUT') return 'TIMEOUT';
    if (t === 'CRIT' || t === 'ERROR' || t === 'FAIL' || t === 'FAILING') return 'CRIT';
    return 'UNKNOWN';
}

function toUiStatus(s?: string | null): DeviceCheckDTO['status'] {
    switch (normalizeStatus(s)) {
        case 'OK': return 'Passing';
        case 'WARN': return 'Warning';
        default: return 'Failing';
    }
}

/* =============================== Service =============================== */

@Injectable()
export class ChecksService {
    private readonly logger = new Logger(ChecksService.name);

    // per-device debounce to avoid floods; value is NodeJS.Timeout in Node
    private readonly deviceDebounce = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(
        private readonly pg: PgPoolService,
        private readonly uiSockets: UiSocketRegistry,
    ) { }

    /* ================= Schema guard (idempotent) ================= */

    /** Ensure minimal schema for checks exists (TEXT device_id). Safe to call often. */
    private async ensureSchema() {
        await this.pg.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS public.check_assignments (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id   text NOT NULL,
        dedupe_key  text,
        check_type  text,
        check_name  text,
        created_at  timestamptz DEFAULT now(),
        updated_at  timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.check_runs (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        assignment_id uuid,
        device_id     text NOT NULL,
        status        text NOT NULL,
        severity      text,
        metrics       jsonb,
        output        text,
        started_at    timestamptz,
        finished_at   timestamptz,
        created_at    timestamptz DEFAULT now()
      );

      -- Unique dedupe per device: explicit key OR type|name fallback
      CREATE UNIQUE INDEX IF NOT EXISTS check_assignments_uk
        ON public.check_assignments (
          device_id,
          COALESCE(
            NULLIF(dedupe_key, ''),
            LOWER(COALESCE(check_type,'')) || '|' || LOWER(COALESCE(check_name,''))
          )
        );

      CREATE INDEX IF NOT EXISTS check_assignments_device_id_idx ON public.check_assignments (device_id);
      CREATE INDEX IF NOT EXISTS check_runs_assignment_id_idx    ON public.check_runs (assignment_id);
      CREATE INDEX IF NOT EXISTS check_runs_device_id_idx        ON public.check_runs (device_id);
      CREATE INDEX IF NOT EXISTS check_runs_created_at_idx       ON public.check_runs (created_at);
    `);
    }

    /* ====================== Public read for UI ====================== */

    async listByDevice(deviceId: string, limit = 100): Promise<{ items: DeviceCheckDTO[] }> {
        if (!Number.isFinite(limit) || limit < 1) limit = 1;
        if (limit > 200) limit = 200;

        await this.ensureSchema();

        // Latest run per assignment + assignment name (no dependency on separate "checks" table)
        const sql = `
      WITH latest_run AS (
        SELECT
          cr.assignment_id,
          cr.status,
          cr.output,
          cr.finished_at AS last_run,
          ROW_NUMBER() OVER (PARTITION BY cr.assignment_id ORDER BY cr.finished_at DESC NULLS LAST) AS rn
        FROM public.check_runs cr
        WHERE cr.device_id = $1
      )
      SELECT
        a.id                      AS assignment_id,
        COALESCE(NULLIF(a.check_name,''), NULLIF(a.check_type,''), 'Check') AS check_name,
        lr.status                 AS run_status,
        lr.output                 AS run_output,
        lr.last_run               AS last_run
      FROM public.check_assignments a
      LEFT JOIN latest_run lr ON lr.assignment_id = a.id AND lr.rn = 1
      WHERE a.device_id = $1
      ORDER BY lr.last_run DESC NULLS LAST, check_name ASC
      LIMIT $2
    `;

        try {
            const { rows } = await this.pg.query<{
                assignment_id: string;
                check_name: string | null;
                run_status: string | null;
                run_output: string | null;
                last_run: Date | string | null;
            }>(sql, [deviceId, limit]);

            const items: DeviceCheckDTO[] = (rows || []).map((r) => ({
                id: r.assignment_id,
                name: r.check_name ?? 'Check',
                status: toUiStatus(r.run_status),
                lastRun: r.last_run ? new Date(r.last_run as any).toISOString() : null,
                output:
                    (r.run_output ?? '').length > 8192
                        ? (r.run_output ?? '').slice(0, 8192) + '…'
                        : r.run_output ?? '',
            }));

            return { items };
        } catch (err: any) {
            const msg = String(err?.message || '').toLowerCase();
            const code = String((err && (err.code || err?.original?.code)) || '');
            if (code === '42P01' || code === '42703' || (msg.includes('relation') && msg.includes('does not exist'))) {
                this.logger.warn('ChecksService.listByDevice: schema not ready; returning empty items.');
                return { items: [] };
            }
            this.logger.error('ChecksService.listByDevice failed', err?.stack || err);
            return { items: [] };
        }
    }

    /* ======================= Agent ingestion ====================== */

    /**
     * Ingest runs from an agent (TEXT deviceId).
     * - Upsert assignment per device using dedupeKey or (type|name) tuple
     * - Insert runs
     * Returns counts for observability.
     */
    async ingestAgentRuns(input: {
        agentId: string;
        deviceId: string; // TEXT (e.g., "win-...")
        runs: Array<{
            assignmentId?: string;
            dedupeKey?: string;
            checkType?: string;
            checkName?: string;
            status: string;
            severity?: 'WARN' | 'CRIT';
            metrics?: Record<string, any>;
            output?: string;
            startedAt?: string;
            finishedAt?: string;
        }>;
    }): Promise<{ inserted: number; assignmentsCreated: number }> {
        if (!input?.runs?.length) return { inserted: 0, assignmentsCreated: 0 };

        await this.ensureSchema();

        const MAX_OUTPUT = 64 * 1024; // 64 KiB

        // ---------- 1) Prepare src rows with a stable ordinal ----------
        const srcValues: string[] = [];
        const srcParams: any[] = [];
        let p = 1;

        for (let i = 0; i < input.runs.length; i++) {
            const r = input.runs[i];
            const dk = r.dedupeKey ?? null;
            const ct = (r.checkType || '').trim().toUpperCase() || null;
            const cn = (r.checkName || ct || 'Agent Check').trim().substring(0, 200) || 'Agent Check';

            // (ord, device_id, dedupe_key, check_type, check_name)
            srcValues.push(`($${p++}::int, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text)`);
            srcParams.push(i + 1, input.deviceId, dk, ct, cn);
        }

        // ---------- 2) Insert missing assignments; count inserted via RETURNING ----------
        const insertSql = `
      WITH src(ord, device_id, dedupe_key, check_type, check_name) AS (
        VALUES ${srcValues.join(',')}
      )
      INSERT INTO public.check_assignments (device_id, dedupe_key, check_type, check_name)
      SELECT s.device_id, s.dedupe_key, s.check_type, s.check_name
      FROM src s
      ON CONFLICT (device_id,
        COALESCE(
          NULLIF(dedupe_key,''),
          LOWER(COALESCE(check_type,'')) || '|' || LOWER(COALESCE(check_name,''))
        ))
      DO NOTHING
      RETURNING id;
    `;
        const insertRes = await this.pg.query<{ id: string }>(insertSql, srcParams);
        const assignmentsCreated = (insertRes.rows || []).length;

        // ---------- 3) Resolve assignment ids for each src row in order ----------
        const mapSql = `
      WITH src(ord, device_id, dedupe_key, check_type, check_name) AS (
        VALUES ${srcValues.join(',')}
      )
      SELECT
        s.ord,
        ca.id::text AS assignment_id
      FROM src s
      JOIN public.check_assignments ca
        ON ca.device_id = s.device_id
       AND COALESCE(NULLIF(ca.dedupe_key,''),
            LOWER(COALESCE(ca.check_type,'')) || '|' || LOWER(COALESCE(ca.check_name,'')))
        = COALESCE(NULLIF(s.dedupe_key,''),
            LOWER(COALESCE(s.check_type,'')) || '|' || LOWER(COALESCE(s.check_name,'')))
      ORDER BY s.ord ASC;
    `;
        const mapRes = await this.pg.query<{ ord: number; assignment_id: string }>(mapSql, srcParams);
        const assignmentByOrd = new Map<number, string>();
        for (const r of mapRes.rows) assignmentByOrd.set(r.ord, r.assignment_id);

        // ---------- 4) Build runs aligned to the original order ----------
        const runValues: string[] = [];
        const runParams: any[] = [];
        p = 1;

        for (let i = 0; i < input.runs.length; i++) {
            const r = input.runs[i];
            const assignmentIdFromMap = assignmentByOrd.get(i + 1);

            const assignmentId =
                (r.assignmentId && /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(r.assignmentId))
                    ? r.assignmentId
                    : assignmentIdFromMap;

            if (!assignmentId) continue; // should not happen, but be defensive

            const status = normalizeStatus(r.status);
            const severity = r.severity === 'CRIT' ? 'CRIT' : r.severity === 'WARN' ? 'WARN' : null;
            const output = (r.output ?? '').slice(0, MAX_OUTPUT);
            const startedAt = r.startedAt ? new Date(r.startedAt) : new Date();
            const finishedAt = r.finishedAt ? new Date(r.finishedAt) : new Date();

            runValues.push(`(
        $${p++}::uuid,        -- assignment_id
        $${p++}::text,        -- device_id
        $${p++}::text,        -- status
        $${p++}::text,        -- severity
        $${p++}::jsonb,       -- metrics
        $${p++}::text,        -- output
        $${p++}::timestamptz, -- started_at
        $${p++}::timestamptz  -- finished_at
      )`);

            runParams.push(
                assignmentId,
                input.deviceId,
                status,
                severity,
                r.metrics ? JSON.stringify(r.metrics) : null,
                output,
                startedAt.toISOString(),
                finishedAt.toISOString(),
            );
        }

        let inserted = 0;
        if (runValues.length) {
            const insSql = `
        INSERT INTO public.check_runs
          (assignment_id, device_id, status, severity, metrics, output, started_at, finished_at)
        VALUES ${runValues.join(',')}
        RETURNING id;
      `;
            const ins = await this.pg.query<{ id: string }>(insSql, runParams);
            inserted = (ins.rows || []).length;
        }

        // Debounced UI broadcast per device
        if (inserted > 0) this.scheduleDeviceBroadcast(input.deviceId, inserted);

        this.logger.log(`ingested ${inserted} run(s) for device ${input.deviceId}; new assignments: ${assignmentsCreated}`);
        return { inserted, assignmentsCreated };
    }

    /** Debounce + emit device_checks_updated to subscribed UI sockets */
    private scheduleDeviceBroadcast(deviceId: string, changed: number) {
        const key = String(deviceId);
        const existing = this.deviceDebounce.get(key);
        if (existing) clearTimeout(existing as any);

        const handle = setTimeout(() => {
            try {
                const payload = {
                    t: 'device_checks_updated',
                    deviceId: key,
                    changed,
                    at: new Date().toISOString(),
                };
                const sent = this.uiSockets.broadcastToDevice(key, payload);
                this.logger.debug(`Broadcast device_checks_updated to ${sent} UI socket(s) for device ${key}`);
            } catch (e: any) {
                this.logger.warn(`Broadcast failed for device ${key}: ${e?.message ?? e}`);
            } finally {
                this.deviceDebounce.delete(key);
            }
        }, 750);

        this.deviceDebounce.set(key, handle);
    }

    /* ============== Server-driven assignments for agent (optional) ============ */

    async getAssignmentsForDevice(deviceId: string): Promise<{
        items: Array<{
            assignmentId: string;
            type: string | null;
            name: string | null;
            intervalSec: number; // static defaults for now
            timeoutSec: number;  // static defaults for now
            enabled: boolean;
            dedupeKey?: string | null;
            config?: any;
            thresholds?: any;
        }>;
    }> {
        await this.ensureSchema();

        // We don’t maintain a separate checks catalog here; return lightweight rows
        const { rows } = await this.pg.query(
            `
      SELECT
        a.id::text            AS assignment_id,
        a.check_type          AS check_type,
        a.check_name          AS check_name,
        a.dedupe_key          AS dedupe_key,
        a.created_at,
        a.updated_at
      FROM public.check_assignments a
      WHERE a.device_id = $1
      ORDER BY a.created_at DESC
      `,
            [deviceId]
        );

        return {
            items: rows.map((r: any) => ({
                assignmentId: r.assignment_id,
                type: r.check_type ?? null,
                name: r.check_name ?? null,
                // simple defaults (agents can override via config if/when you add it)
                intervalSec: 60,
                timeoutSec: 10,
                enabled: true,
                dedupeKey: r.dedupe_key,
                config: null,
                thresholds: null,
            })),
        };
    }

    /* ======================== Placeholders (unchanged) ======================== */

    async list(_params: {
        scope?: CheckScope;
        type?: CheckType;
        enabled?: boolean;
        clientId?: string;
        siteId?: string;
        deviceId?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{ items: any[]; nextCursor?: string | null }> {
        throw new NotImplementedException('ChecksService.list not implemented yet');
    }

    async create(_payload: any): Promise<any> {
        throw new NotImplementedException('ChecksService.create not implemented yet');
    }

    async update(_id: string, _payload: any): Promise<any> {
        throw new NotImplementedException('ChecksService.update not implemented yet');
    }

    async remove(_id: string): Promise<{ id: string; deleted: boolean }> {
        throw new NotImplementedException('ChecksService.remove not implemented yet');
    }

    async rebuildAssignments(_id: string): Promise<{ checkId: string; assignmentsRebuilt: number }> {
        throw new NotImplementedException('ChecksService.rebuildAssignments not implemented yet');
    }

    async runOnDemand(_id: string, _params?: { deviceIds?: string[] | null }): Promise<{ enqueued: number }> {
        throw new NotImplementedException('ChecksService.runOnDemand not implemented yet');
    }
}
