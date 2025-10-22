// backend/src/maintenance/session-cleaner.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SessionCleanerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SessionCleanerService.name);
    private timer: NodeJS.Timeout | null = null;

    constructor(private readonly pg: PgPoolService) { }

    onModuleInit() {
        // first run shortly after boot
        this.timer = setTimeout(() => this.runOnce().catch(() => { }), 15_000) as unknown as NodeJS.Timeout;
        // then daily
        this.timer = setInterval(() => this.runOnce().catch(() => { }), DAY_MS) as unknown as NodeJS.Timeout;
    }

    async onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async runOnce() {
        try {
            const res = await this.pg.query<{ count: string }>(
                `WITH del AS (
           DELETE FROM sessions
            WHERE revoked_at IS NOT NULL
              AND revoked_at < now() - interval '30 days'
            RETURNING 1
         )
         SELECT count(*)::text AS count FROM del`
            );
            const c = res.rows?.[0]?.count ?? "0";
            this.logger.log(`Pruned ${c} revoked sessions older than 30 days.`);
        } catch (e) {
            this.logger.warn(`Session prune failed: ${(e as Error)?.message || e}`);
        }
    }
}
