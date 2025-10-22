import { Injectable } from "@nestjs/common";

// Use CommonJS require to avoid TS “namespace as type” issues with pg types
const { Pool } = require("pg");

export type DkimRow = {
    id: number;
    domain: string;
    selector: string;
    private_key: string | null;
    updated_at: string; // timestamptz
};

@Injectable()
export class DkimRepository {
    private pool: any;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }

    /**
     * Returns the single DKIM row (id=1) or a default empty row if none.
     */
    async get(): Promise<DkimRow> {
        const res = await this.pool.query(
            `SELECT id, domain, selector, private_key, updated_at
         FROM dkim_settings
        WHERE id = 1`
        );

        if (res.rows?.length) {
            return res.rows[0] as DkimRow;
        }

        // Default empty
        return {
            id: 1,
            domain: "",
            selector: "",
            private_key: null,
            updated_at: new Date(0).toISOString(),
        };
    }

    /**
     * Upserts domain + selector; privateKey is optional (omit to preserve).
     */
    async save(input: { domain: string; selector: string; privateKey?: string }) {
        const fields: string[] = ["id", "domain", "selector", "updated_at"];
        const values: any[] = [1, input.domain, input.selector, new Date().toISOString()];

        if (typeof input.privateKey === "string") {
            fields.push("private_key");
            values.push(input.privateKey);
        }

        const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");

        const updates = fields
            .filter((f) => f !== "id")
            .map((f) => `${f} = EXCLUDED.${f}`)
            .join(", ");

        const sql = `
      INSERT INTO dkim_settings (${fields.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updates}
    `;

        await this.pool.query(sql, values);
    }
}
