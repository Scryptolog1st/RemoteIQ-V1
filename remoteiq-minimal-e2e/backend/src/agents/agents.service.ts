// backend/src/agents/agents.service.ts
import { Injectable } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";

// DTOs are validated in controllers; here we accept partials safely.
type UpdateAgentFacts = Partial<{
    hostname: string;
    os: string;
    arch: string | null;         // NOT NULL in DB → we will ignore null updates
    version: string | null;      // nullable
    primaryIp: string | null;    // nullable
    client: string | null;       // nullable
    site: string | null;         // nullable
    user: string | null;         // alias accepted from agent payloads
    loggedInUser: string | null; // alias (both map to logged_in_user)
}>;

type SoftwareItem = {
    name: string;
    version?: string | null;
    publisher?: string | null;
    installDate?: string | null;
};

@Injectable()
export class AgentsService {
    constructor(private readonly pg: PgPoolService) { }

    /** Return the stable UUID mirror for a numeric agent id (or null if absent). */
    async getAgentUuidById(agentId: number): Promise<string | null> {
        try {
            const { rows } = await this.pg.query<{ agent_uuid: string | null }>(
                `SELECT agent_uuid FROM public.agents WHERE id = $1 LIMIT 1`,
                [agentId]
            );
            return rows[0]?.agent_uuid ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Update agent facts and bump last_seen_at.
     * - Only updates provided fields.
     * - Never sets NOT NULL columns to NULL.
     */
    async updateFacts(agentId: number, facts: UpdateAgentFacts): Promise<void> {
        const sets: string[] = [`last_seen_at = NOW()`];
        const params: any[] = [];
        let p = 1;

        // For columns that are NOT NULL in your schema, do not accept null writes.
        const setIfDefined = (col: string, val: any) => {
            if (val !== undefined) {
                sets.push(`${col} = $${p++}`);
                params.push(val);
            }
        };
        const setIfNullable = (col: string, val: any) => {
            if (val !== undefined) {
                sets.push(`${col} = $${p++}`);
                params.push(val); // can be null; that’s fine for nullable cols
            }
        };
        const setIfNotNull = (col: string, val: any) => {
            if (val !== undefined && val !== null) {
                sets.push(`${col} = $${p++}`);
                params.push(val);
            }
        };

        // Likely NOT NULL in table
        setIfDefined("hostname", facts.hostname);
        setIfDefined("os", facts.os);
        setIfNotNull("arch", facts.arch); // skip if null/undefined

        // Nullable fields
        setIfNullable("version", facts.version ?? undefined);
        setIfNullable("primary_ip", facts.primaryIp ?? undefined);
        setIfNullable("client", facts.client ?? undefined);
        setIfNullable("site", facts.site ?? undefined);

        // Accept both 'user' and 'loggedInUser' from payloads → store in logged_in_user
        const loginUser = facts.user ?? facts.loggedInUser;
        setIfNullable("logged_in_user", loginUser ?? undefined);

        const sql = `
      UPDATE public.agents
      SET ${sets.join(", ")}
      WHERE id = $${p}
    `;
        params.push(agentId);

        await this.pg.query(sql, params);
    }

    /** Upsert full software inventory for an agent. */
    async upsertSoftware(agentId: number, items: SoftwareItem[]): Promise<void> {
        if (!Array.isArray(items) || items.length === 0) return;

        const valuesSql: string[] = [];
        const params: any[] = [];
        let p = 1;

        for (const it of items) {
            const name = (it.name || "").trim();
            if (!name) continue;

            valuesSql.push(`(
        $${p++}::integer,
        $${p++}::text,
        $${p++}::text,
        $${p++}::text,
        $${p++}::timestamptz
      )`);

            params.push(
                agentId,
                name,
                it.version ?? null,
                it.publisher ?? null,
                it.installDate ? new Date(it.installDate) : null
            );
        }

        if (valuesSql.length === 0) return;

        // Requires a matching unique index/constraint in DB:
        // CREATE UNIQUE INDEX IF NOT EXISTS agent_software_uk ON public.agent_software (agent_id, lower(name), COALESCE(version,''));
        const sql = `
      INSERT INTO public.agent_software (agent_id, name, version, publisher, install_date)
      VALUES ${valuesSql.join(",")}
      ON CONFLICT (agent_id, lower(name), COALESCE(version,'')) DO UPDATE
      SET
        publisher = EXCLUDED.publisher,
        install_date = EXCLUDED.install_date
    `;
        await this.pg.query(sql, params);
    }
}

