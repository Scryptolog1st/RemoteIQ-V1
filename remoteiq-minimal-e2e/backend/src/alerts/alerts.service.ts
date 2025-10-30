import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PgPoolService } from '../storage/pg-pool.service';

export enum AlertState {
    OPEN = 'OPEN',
    ACKED = 'ACKED',
    SILENCED = 'SILENCED',
    RESOLVED = 'RESOLVED',
}

export type AlertRecord = {
    id: string;
    assignmentId: string;
    currentState: AlertState;
    currentSeverity: 'WARN' | 'CRIT';
    firstSeenAt: string;
    lastSeenAt: string;
    lastStateChangeAt: string;
    dedupeKey: string;
    openCount: number;
    acknowledgedBy?: string | null;
    silencedBy?: string | null;
    resolvedBy?: string | null;
    reason?: string | null;
    maintenance: boolean;
};

@Injectable()
export class AlertsService {
    private readonly logger = new Logger(AlertsService.name);

    constructor(private readonly pg: PgPoolService) { }

    async list(params: {
        state?: AlertState[];
        severity?: ('WARN' | 'CRIT')[];
        clientId?: string;
        siteId?: string;
        deviceId?: string;
        type?: string;
        q?: string;
        from?: string;
        to?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{ items: AlertRecord[]; nextCursor?: string | null }> {
        // TODO: implement tenant-scoped, paginated query with safe filters
        throw new NotImplementedException('AlertsService.list not implemented yet');
    }

    async getTimeline(alertId: string): Promise<{ events: any[] }> {
        // TODO: fetch alert_events rows ordered by created_at
        throw new NotImplementedException('AlertsService.getTimeline not implemented yet');
    }

    async ack(alertId: string, reason?: string): Promise<{ id: string; state: AlertState }> {
        // TODO: transition with audit event and actor
        throw new NotImplementedException('AlertsService.ack not implemented yet');
    }

    async silence(alertId: string, reason?: string, until?: string | null): Promise<{ id: string; state: AlertState }> {
        // TODO: transition + optional silence window
        throw new NotImplementedException('AlertsService.silence not implemented yet');
    }

    async unsilence(alertId: string): Promise<{ id: string; state: AlertState }> {
        // TODO: revert silence
        throw new NotImplementedException('AlertsService.unsilence not implemented yet');
    }

    async resolve(alertId: string, reason?: string): Promise<{ id: string; state: AlertState }> {
        // TODO: resolve with audit event
        throw new NotImplementedException('AlertsService.resolve not implemented yet');
    }

    async bulk(
        action: 'ack' | 'silence' | 'resolve',
        params: { ids?: string[]; filter?: Record<string, any>; reason?: string; until?: string | null },
    ): Promise<{ count: number }> {
        // TODO: bulk operations with proper filters and rate limits
        throw new NotImplementedException('AlertsService.bulk not implemented yet');
    }
}
