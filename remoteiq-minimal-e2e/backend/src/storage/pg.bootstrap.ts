// backend/src/storage/pg.bootstrap.ts
import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { PgPoolService } from "./pg-pool.service";

/**
 * Optional bootstrap that applies env-based defaults at startup.
 * If PgPoolService isn’t present in the DI graph, this safely no-ops.
 */
@Injectable()
export class PgBootstrap implements OnModuleInit {
    constructor(@Optional() private readonly pg?: PgPoolService) { }

    onModuleInit() {
        if (!this.pg) {
            // Not wired yet (or not exported/imported). Don’t crash.
            console.warn("PgBootstrap: PgPoolService not found; skipping PG bootstrap.");
            return;
        }

        try {
            this.pg.configure({
                connectionString:
                    process.env.DATABASE_URL ||
                    process.env.PG_URL ||
                    "postgres://remoteiq:remoteiqpass@localhost:5432/remoteiq",
                ssl:
                    (process.env.DATABASE_SSL ?? "").toLowerCase() === "true"
                        ? { rejectUnauthorized: false }
                        : false,
                max: Number.isFinite(+process.env.DATABASE_POOL_MAX!)
                    ? Number(process.env.DATABASE_POOL_MAX)
                    : 10,
                min: Number.isFinite(+process.env.DATABASE_POOL_MIN!)
                    ? Number(process.env.DATABASE_POOL_MIN)
                    : 0,
            });
        } catch (e) {
            console.warn(
                "PgBootstrap: configure() failed:",
                (e as Error)?.message ?? e
            );
        }
    }
}
