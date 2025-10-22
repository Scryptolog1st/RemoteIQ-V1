// backend/src/imap/imap-ingest.repository.ts
import { Injectable } from "@nestjs/common";
import { Pool } from "pg";

export interface IngestedMailRow {
    id?: number;
    purpose: "alerts" | "invites" | "password_resets" | "reports";
    uid: number;
    from_addr: string | null;
    subject: string | null;
    size_bytes: number | null;
    headers_snippet: string | null;
    is_bounce: boolean;
    bounce_recipient: string | null;
    bounce_status: string | null;
    bounce_action: string | null;
    bounce_diagnostic: string | null;
    created_at?: string; // timestamptz
}

@Injectable()
export class ImapIngestRepository {
    // Avoid TS namespace/type weirdness in some setups by not annotating with Pool
    private pool: any;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }

    private async ensureTable() {
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS imap_ingested (
        id BIGSERIAL PRIMARY KEY,
        purpose TEXT NOT NULL,
        uid BIGINT NOT NULL,
        from_addr TEXT,
        subject TEXT,
        size_bytes INTEGER,
        headers_snippet TEXT,
        is_bounce BOOLEAN NOT NULL DEFAULT FALSE,
        bounce_recipient TEXT,
        bounce_status TEXT,
        bounce_action TEXT,
        bounce_diagnostic TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(purpose, uid)
      );
    `);
    }

    async insertIngested(row: IngestedMailRow) {
        await this.ensureTable();
        const sql = `
      INSERT INTO imap_ingested
        (purpose, uid, from_addr, subject, size_bytes, headers_snippet,
         is_bounce, bounce_recipient, bounce_status, bounce_action, bounce_diagnostic)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (purpose, uid) DO NOTHING
    `;
        const vals = [
            row.purpose,
            row.uid,
            row.from_addr,
            row.subject,
            row.size_bytes ?? null,
            row.headers_snippet ?? null,
            !!row.is_bounce,
            row.bounce_recipient ?? null,
            row.bounce_status ?? null,
            row.bounce_action ?? null,
            row.bounce_diagnostic ?? null,
        ];
        await this.pool.query(sql, vals);
    }
}
