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
    // Room for future types, UI already tolerates optional fields
}

export type DeviceCheckDTO = {
    id: string; // assignment id (device-scoped)
    name: string;
    status: 'Passing' | 'Warning' | 'Failing';
    lastRun: string | null;
    output: string;
    // Optional advanced fields the UI will render if present (left undefined for now)
    // type?: string; severity?: 'WARN' | 'CRIT'; metrics?: Record<string, any>; thresholds?: Record<string, any>;
    // tags?: string[]; maintenance?: boolean; dedupeKey?: string;
};

@Injectable()
export class ChecksService {
    private readonly logger = new Logger(ChecksService.name);
    constructor(private readonly pg: PgPoolService) { }

    /** Map engine statuses to UI’s 3-state model */
    private mapRunStatusToUi(s?: string | null): DeviceCheckDTO['status'] {
        const t = String(s || '').toUpperCase();
        if (t === 'OK' || t === 'PASS' || t === 'PASSING') return 'Passing';
        if (t === 'WARN' || t === 'WARNING') return 'Warning';
        // Treat anything else as failing (CRIT/ERROR/TIMEOUT/UNKNOWN)
        return 'Failing';
    }

    /**
     * Return latest status per device-level assignment.
     * If the schema is not yet present, we gracefully return an empty list.
     */
    async listByDevice(deviceId: string, limit = 100): Promise<{ items: DeviceCheckDTO[] }> {
        // Clamp limit to a safe range
        if (!Number.isFinite(limit) || limit < 1) limit = 1;
        if (limit > 200) limit = 200;

        // NOTE: These table names match the proposed schema.
        // If they don't exist yet, we catch and return [].
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
        c.type AS check_type,
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
            // Prefer a simple PgPoolService.query<T>(text, params) shape.
            const { rows } = await this.pg.query<{
                assignment_id: string;
                check_name: string | null;
                check_type: string | null;
                run_status: string | null;
                run_output: string | null;
                last_run: Date | string | null;
            }>(sql, [deviceId, limit]);

            const items: DeviceCheckDTO[] = (rows || []).map((r) => ({
                id: r.assignment_id,
                name: r.check_name ?? 'Check',
                status: this.mapRunStatusToUi(r.run_status),
                lastRun: r.last_run ? new Date(r.last_run as any).toISOString() : null,
                // Truncate oversized output to protect UI; backend will still store full log
                output:
                    (r.run_output ?? '').length > 8192
                        ? (r.run_output ?? '').slice(0, 8192) + '…'
                        : r.run_output ?? '',
            }));

            return { items };
        } catch (err: any) {
            // If tables don’t exist yet or columns aren’t present, don’t crash the UI.
            const msg = String(err?.message || '').toLowerCase();
            const code = String((err && (err.code || err?.original?.code)) || '');
            // Postgres "undefined_table" = 42P01; also handle undefined_column 42703
            if (code === '42P01' || code === '42703' || msg.includes('relation') && msg.includes('does not exist')) {
                this.logger.warn('ChecksService.listByDevice: schema not ready yet; returning empty items.');
                return { items: [] };
            }
            this.logger.error('ChecksService.listByDevice failed', err?.stack || err);
            // For safety, still avoid leaking details
            return { items: [] };
        }
    }

    // --------------------- Placeholders for future routes ---------------------
    async list(params: {
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
