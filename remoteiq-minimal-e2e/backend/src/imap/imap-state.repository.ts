// backend/src/imap/imap-state.repository.ts
import * as pg from "pg";

export class ImapStateRepository {
    private pool: any;

    constructor() {
        this.pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }

    async ensureTable() {
        const sql = `
    CREATE TABLE IF NOT EXISTS imap_state (
      purpose    TEXT PRIMARY KEY,
      last_uid   BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    `;
        await this.pool.query(sql);
    }

    async getLastUid(purpose: string): Promise<number> {
        const res = await this.pool.query(
            `SELECT last_uid FROM imap_state WHERE purpose = $1`,
            [purpose]
        );
        if (res.rows?.length) return Number(res.rows[0].last_uid) || 0;
        // seed row if missing
        await this.pool.query(
            `INSERT INTO imap_state (purpose, last_uid) VALUES ($1, 0)
       ON CONFLICT (purpose) DO NOTHING`,
            [purpose]
        );
        return 0;
    }

    async setLastUid(purpose: string, uid: number) {
        await this.pool.query(
            `INSERT INTO imap_state (purpose, last_uid, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (purpose)
       DO UPDATE SET last_uid = EXCLUDED.last_uid, updated_at = now()`,
            [purpose, uid]
        );
    }
}
