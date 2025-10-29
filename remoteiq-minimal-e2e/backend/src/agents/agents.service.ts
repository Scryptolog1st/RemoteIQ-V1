import { Injectable } from '@nestjs/common';
import { PgPoolService } from '../storage/pg-pool.service';
import { UpdateAgentFactsDto } from './dto/update-agent-facts.dto';

@Injectable()
export class AgentsService {
    constructor(private readonly db: PgPoolService) { }

    private sanitizeUser(s?: string | null): string | null {
        if (!s) return null;
        const cleaned = s.replace(/[^\x20-\x7E]/g, '').slice(0, 128);
        return cleaned || null;
    }

    async touch(agentId: number): Promise<void> {
        await this.db.query(
            `
      UPDATE public.agents
         SET last_seen_at = NOW(),
             updated_at   = NOW()
       WHERE id = $1
      `,
            [agentId],
        );
    }

    async updateFacts(agentId: number, facts: UpdateAgentFactsDto): Promise<void> {
        const sets: string[] = ['last_seen_at = NOW()', 'updated_at = NOW()'];
        const args: any[] = [agentId];
        let p = 1;

        const maybeSet = (column: string, value: unknown) => {
            if (value === undefined || value === null || value === '') return;
            sets.push(`${column} = $${++p}`);
            args.push(value);
        };

        maybeSet('os', facts.os);
        maybeSet('arch', facts.arch);
        maybeSet('version', facts.version);
        maybeSet('primary_ip', facts.primaryIp);
        maybeSet('logged_in_user', this.sanitizeUser(facts.user));

        const sql = `
      UPDATE public.agents
         SET ${sets.join(', ')}
       WHERE id = $1
    `;
        await this.db.query(sql, args);
    }

    /**
     * Replace software inventory for this agent.
     */
    async upsertSoftware(
        agentId: number,
        items: { name: string; version?: string | null; publisher?: string | null; installDate?: string | null }[],
    ): Promise<void> {
        await this.db.query(`DELETE FROM public.agent_software WHERE agent_id = $1`, [agentId]);
        if (!items?.length) return;

        const values: any[] = [];
        const tuples: string[] = [];
        let p = 1;

        for (const s of items) {
            values.push(
                agentId,
                s.name,
                s.version ?? null,
                s.publisher ?? null,
                s.installDate ?? null, // string "YYYY-MM-DD" or null
            );
            // Cast the final param to ::date so PG stores it correctly
            tuples.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}::date)`);
        }

        await this.db.query(
            `
      INSERT INTO public.agent_software (agent_id, name, version, publisher, install_date)
      VALUES ${tuples.join(', ')}
      `,
            values,
        );
    }
}
