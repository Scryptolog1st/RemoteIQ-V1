//remoteiq-minimal-e2e\backend\src\checks\checks.service.ts

import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PgPoolService } from '../storage/pg-pool.service';

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

@Injectable()
export class ChecksService {
    private readonly logger = new Logger(ChecksService.name);
    constructor(private readonly pg: PgPoolService) { }

    /* ====================== Public read for UI (existing) ====================== */

    async listByDevice(deviceId: string, limit = 100): Promise<{ items: DeviceCheckDTO[] }> {
        if (!Number.isFinite(limit) || limit < 1) limit = 1;
        if (limit > 200) limit = 200;

        const sql = `
      WITH latest_run AS (
        SELECT
          cr.assignment_id,
          cr.status,
          cr.output,
          cr.finished_at AS last_run,
          ROW_NUMBER() OVER (PARTITION BY cr.assignment_id ORDER BY cr.finished_at DESC NULLS LAST) AS rn
        FROM check_runs cr
      )
      SELECT
        a.id AS assignment_id,
        c.name AS check_name,
        lr.status AS run_status,
        lr.output AS run_output,
        lr.last_run
      FROM check_assignments a
      JOIN checks c ON c.id = a.check_id
      LEFT JOIN latest_run lr ON lr.assignment_id = a.id AND lr.rn = 1
      WHERE a.enabled = TRUE
        AND a.device_id = $1
      ORDER BY lr.last_run DESC NULLS LAST, c.name ASC
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

    /* ======================= Agent ingestion (new) ============================ */

    /**
     * Ingest runs from an agent.
     * - Upsert check (by type+name) if needed (scope=DEVICE)
     * - Upsert assignment (by id or (check_id, device_id) / dedupe_key)
     * - Insert runs (status normalized; output clamped)
     * Returns counts for observability.
     */
    async ingestAgentRuns(input: {
        agentId: string;
        deviceId: string;
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

        // Clamp large payloads aggressively to protect DB
        const MAX_OUTPUT = 64 * 1024; // 64 KiB

        let inserted = 0;
        let assignmentsCreated = 0;

        for (const r of input.runs) {
            // Resolve/ensure check_id
            let checkId: string | null = null;

            if (r.assignmentId) {
                // If assignment exists, get check_id from it
                const a = await this.pg.query<{ check_id: string }>(
                    `SELECT check_id FROM check_assignments WHERE id = $1 LIMIT 1`,
                    [r.assignmentId]
                );
                if (a.rows.length) {
                    checkId = a.rows[0].check_id;
                }
            }

            if (!checkId) {
                // Find-or-create check by (type,name) to avoid catalog explosion
                const type = (r.checkType || '').trim().toUpperCase();
                const name = (r.checkName || type || 'Agent Check').trim().substring(0, 200) || 'Agent Check';

                if (!type) {
                    // If no type given and we also didn't have assignmentId, we can't safely proceed.
                    this.logger.warn(`ingestAgentRuns: missing checkType for run; skipping.`);
                    continue;
                }

                // Try fetch existing
                const existing = await this.pg.query<{ id: string }>(
                    `SELECT id FROM checks WHERE type = $1 AND name = $2 LIMIT 1`,
                    [type, name]
                );
                if (existing.rows.length) {
                    checkId = existing.rows[0].id;
                } else {
                    // Create a minimal DEVICE-scoped check
                    const ins = await this.pg.query<{ id: string }>(
                        `INSERT INTO checks (scope, type, name, severity_default, interval_sec, timeout_sec, enabled)
             VALUES ('DEVICE', $1, $2, 'WARN', 60, 10, TRUE)
             RETURNING id`,
                        [type, name]
                    );
                    checkId = ins.rows[0].id;
                }
            }

            if (!checkId) continue;

            // Resolve/ensure assignment_id for this device
            let assignmentId = r.assignmentId?.trim() || null;

            if (assignmentId) {
                // Validate device ownership
                const chk = await this.pg.query<{ id: string }>(
                    `SELECT id FROM check_assignments WHERE id = $1 AND device_id = $2 LIMIT 1`,
                    [assignmentId, input.deviceId]
                );
                if (chk.rows.length === 0) {
                    // provided assignmentId doesn't belong to this device → ignore and fall back to lookup
                    assignmentId = null;
                }
            }

            if (!assignmentId) {
                // Lookup by (check_id, device_id) or dedupe_key
                if (r.dedupeKey) {
                    const foundByKey = await this.pg.query<{ id: string }>(
                        `SELECT id FROM check_assignments WHERE device_id = $1 AND dedupe_key = $2 LIMIT 1`,
                        [input.deviceId, r.dedupeKey]
                    );
                    if (foundByKey.rows.length) {
                        assignmentId = foundByKey.rows[0].id;
                    }
                }
                if (!assignmentId) {
                    const found = await this.pg.query<{ id: string }>(
                        `SELECT id FROM check_assignments WHERE device_id = $1 AND check_id = $2 LIMIT 1`,
                        [input.deviceId, checkId]
                    );
                    if (found.rows.length) {
                        assignmentId = found.rows[0].id;
                    }
                }
                if (!assignmentId) {
                    // Create new assignment
                    const ins = await this.pg.query<{ id: string }>(
                        `INSERT INTO check_assignments (check_id, device_id, enabled, dedupe_key)
             VALUES ($1, $2, TRUE, $3)
             ON CONFLICT (check_id, device_id) WHERE device_id IS NOT NULL
             DO UPDATE SET updated_at = now()
             RETURNING id`,
                        [checkId, input.deviceId, r.dedupeKey || null]
                    );
                    assignmentId = ins.rows[0].id;
                    assignmentsCreated++;
                }
            }

            // Insert run
            const status = normalizeStatus(r.status);
            const severity = r.severity === 'CRIT' ? 'CRIT' : r.severity === 'WARN' ? 'WARN' : null;

            const output =
                (r.output ?? '').slice(0, MAX_OUTPUT);

            const startedAt = r.startedAt ? new Date(r.startedAt) : new Date();
            const finishedAt = r.finishedAt ? new Date(r.finishedAt) : new Date();

            await this.pg.query(
                `INSERT INTO check_runs (assignment_id, status, severity, metrics, output, started_at, finished_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
                [
                    assignmentId,
                    status,
                    severity,
                    JSON.stringify(r.metrics ?? {}),
                    output,
                    startedAt.toISOString(),
                    finishedAt.toISOString(),
                ]
            );

            inserted++;
        }

        // TODO (optional): broadcast a UI event (different WS gateway for dashboards).
        // For now we log; front-end polls via HTTP.
        this.logger.log(`ingested ${inserted} run(s) for device ${input.deviceId}; new assignments: ${assignmentsCreated}`);

        return { inserted, assignmentsCreated };
    }

    /* ============== Server-driven assignments for agent (optional) ============ */

    async getAssignmentsForDevice(deviceId: string): Promise<{
        items: Array<{
            assignmentId: string;
            checkId: string;
            type: string;
            name: string;
            intervalSec: number;
            timeoutSec: number;
            enabled: boolean;
            dedupeKey?: string | null;
            config?: any;
            thresholds?: any;
        }>;
    }> {
        const sql = `
      SELECT
        a.id AS assignment_id,
        c.id AS check_id,
        c.type,
        c.name,
        c.interval_sec,
        c.timeout_sec,
        a.enabled,
        a.dedupe_key,
        COALESCE(a.config, c.config) AS config,
        COALESCE(a.thresholds, c.threshold) AS thresholds
      FROM check_assignments a
      JOIN checks c ON c.id = a.check_id
      WHERE a.device_id = $1
    `;
        const { rows } = await this.pg.query<{
            assignment_id: string;
            check_id: string;
            type: string;
            name: string;
            interval_sec: number;
            timeout_sec: number;
            enabled: boolean;
            dedupe_key: string | null;
            config: any;
            thresholds: any;
        }>(sql, [deviceId]);

        return {
            items: rows.map(r => ({
                assignmentId: r.assignment_id,
                checkId: r.check_id,
                type: r.type,
                name: r.name,
                intervalSec: r.interval_sec,
                timeoutSec: r.timeout_sec,
                enabled: r.enabled,
                dedupeKey: r.dedupe_key,
                config: r.config,
                thresholds: r.thresholds,
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
