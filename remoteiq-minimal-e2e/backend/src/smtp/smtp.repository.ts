// backend/src/smtp/smtp.repository.ts
import { Injectable, OnModuleDestroy } from "@nestjs/common";

// Use CJS require to avoid TS namespace/type hiccups across tsconfig variants
// and older @types/pg combos.
const { Pool } = require("pg");

export type EmailPurpose = "alerts" | "invites" | "password_resets" | "reports";

export interface EmailSettingsRow {
    purpose: EmailPurpose;
    enabled: boolean;

    smtp_host: string;
    smtp_port: number | null;
    smtp_username: string;
    smtp_password: string | null;
    smtp_use_tls: boolean;
    smtp_use_ssl: boolean;
    smtp_from_address: string;

    imap_host: string;
    imap_port: number | null;
    imap_username: string;
    imap_password: string | null;
    imap_use_ssl: boolean;

    pop_host: string;
    pop_port: number | null;
    pop_username: string;
    pop_password: string | null;
    pop_use_ssl: boolean;

    updated_at: string; // timestamptz
}

@Injectable()
export class SmtpRepository implements OnModuleDestroy {
    // Intentionally 'any' to dodge Pool typing issues in some TS configs
    private pool: any;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }

    async onModuleDestroy(): Promise<void> {
        try {
            await this.pool.end();
        } catch {
            // ignore
        }
    }

    async getAllRaw(): Promise<Record<EmailPurpose, EmailSettingsRow>> {
        const res = await this.pool.query(
            `SELECT * FROM email_settings ORDER BY purpose ASC`
        );
        const rows = res.rows as EmailSettingsRow[];

        const map: Partial<Record<EmailPurpose, EmailSettingsRow>> = {};
        for (const r of rows) map[r.purpose] = r;

        // Ensure all four purposes exist for the UI
        const purposes: EmailPurpose[] = ["alerts", "invites", "password_resets", "reports"];
        for (const p of purposes) {
            if (!map[p]) {
                map[p] = {
                    purpose: p,
                    enabled: true,
                    smtp_host: "",
                    smtp_port: 587,
                    smtp_username: "",
                    smtp_password: null,
                    smtp_use_tls: true,
                    smtp_use_ssl: false,
                    smtp_from_address: "",
                    imap_host: "",
                    imap_port: 993,
                    imap_username: "",
                    imap_password: null,
                    imap_use_ssl: true,
                    pop_host: "",
                    pop_port: 995,
                    pop_username: "",
                    pop_password: null,
                    pop_use_ssl: true,
                    updated_at: new Date(0).toISOString(),
                };
            }
        }
        return map as Record<EmailPurpose, EmailSettingsRow>;
    }

    /**
     * Upsert only provided fields (plus updated_at) using INSERT ... ON CONFLICT.
     */
    async upsertOne(purpose: EmailPurpose, patch: Partial<EmailSettingsRow>): Promise<void> {
        const cols: string[] = [];
        const vals: any[] = [];

        for (const [k, v] of Object.entries(patch)) {
            if (v !== undefined) {
                cols.push(k);
                vals.push(v);
            }
        }

        cols.push("updated_at");
        vals.push(new Date().toISOString());

        const insertCols = ["purpose", ...cols];
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(", ");
        const allVals = [purpose, ...vals];

        const updateSet = cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");

        const sql = `
      INSERT INTO email_settings (${insertCols.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (purpose) DO UPDATE SET
        ${updateSet}
    `;

        await this.pool.query(sql, allVals);
    }
}
