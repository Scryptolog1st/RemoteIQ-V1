// backend/src/devices/devices.service.ts
import { Injectable } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";

export type Device = {
    id: string;
    hostname: string;
    os: string;
    arch?: string | null;
    lastSeen: string | null;
    status: "online" | "offline";
    client?: string | null;
    site?: string | null;
    user?: string | null;
};

function decodeCursor(cur?: string | null) {
    if (!cur) return 0;
    try {
        const n = parseInt(Buffer.from(cur, "base64url").toString("utf8"), 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
        return 0;
    }
}
function encodeCursor(n: number) {
    return Buffer.from(String(n), "utf8").toString("base64url");
}

@Injectable()
export class DevicesService {
    constructor(private readonly pg: PgPoolService) { }

    async list(opts: {
        pageSize: number;
        cursor?: string | null;
        q?: string;
        status?: "online" | "offline";
        os?: string[];
    }): Promise<{ items: Device[]; nextCursor: string | null }> {
        const { pageSize, cursor, q, status, os } = opts;
        const offset = decodeCursor(cursor);

        const where: string[] = [];
        const params: any[] = [];
        let p = 1;

        if (q && q.trim()) {
            where.push(`hostname ILIKE $${p++}`);
            params.push(`%${q.trim()}%`);
        }
        if (status) {
            where.push(`status = $${p++}`);
            params.push(status);
        }
        if (os && os.length) {
            where.push(`lower(os) = ANY($${p++})`);
            params.push(os.map((o) => String(o).toLowerCase()));
        }

        const limit = pageSize + 1; // fetch one extra row to know if there’s a next page
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const sql = `
      SELECT id, hostname, os, arch, last_seen, status,
             client, site, "user"
      FROM devices
      ${whereSql}
      ORDER BY hostname ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

        const { rows } = await this.pg.query(sql, params);

        const hasNext = rows.length > pageSize;
        const items = rows.slice(0, pageSize).map((r: any) => ({
            id: r.id,
            hostname: r.hostname,
            os: r.os,
            arch: r.arch ?? null,
            lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : null,
            status: r.status,
            client: r.client ?? null,
            site: r.site ?? null,
            user: r.user ?? null,
        })) as Device[];

        return { items, nextCursor: hasNext ? encodeCursor(offset + pageSize) : null };
    }

    async getOne(id: string): Promise<Device | null> {
        const { rows } = await this.pg.query(
            `SELECT id, hostname, os, arch, last_seen, status,
                client, site, "user"
                FROM devices
                WHERE id = $1
                LIMIT 1`,
            [id]
        );
        const r = rows[0];
        if (!r) return null;
        return {
            id: r.id,
            hostname: r.hostname,
            os: r.os,
            arch: r.arch ?? null,
            lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : null,
            status: r.status,
            client: r.client ?? null,
            site: r.site ?? null,
            user: r.user ?? null,
        };
    }
}
