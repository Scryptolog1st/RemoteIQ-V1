import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PgPoolService } from '../storage/pg-pool.service';

/**
 * Skeleton scheduler.
 * - Does not start any timers/cron yet.
 * - Provides an explicit `tick()` you can call from e2e tests or dev.
 * - When you’re ready, wire Nest Schedule or your queue worker here.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(private readonly pg: PgPoolService) { }

    async onModuleInit() {
        this.logger.log('SchedulerService initialized (no recurring jobs yet).');
    }

    /**
     * Manually process due check assignments.
     * TODO:
     *  - SELECT assignments where next_run_at <= now(), enabled = true (tenant-scoped)
     *  - Enqueue per-device tasks via WS/agent gateway
     *  - Update next_run_at using interval_sec with jitter
     */
    async tick(): Promise<{ scanned: number; enqueued: number }> {
        // Placeholder to keep behavior safe until DB + WS contracts are in place.
        this.logger.warn('Scheduler tick called, but not implemented yet.');
        return { scanned: 0, enqueued: 0 };
    }
}
