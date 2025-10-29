// backend/src/devices/devices.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
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
  version?: string | null;
  primaryIp?: string | null;
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

    const limit = pageSize + 1;
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      WITH agent_rows AS (
        SELECT
          a.id::text                                   AS id,
          COALESCE(a.hostname, a.device_id, 'unknown') AS hostname,
          COALESCE(NULLIF(a.os, ''), 'unknown')        AS os,
          a.arch                                       AS arch,
          a.last_seen_at                               AS last_seen,
          CASE
            WHEN a.last_seen_at IS NOT NULL
             AND a.last_seen_at > NOW() - INTERVAL '5 minutes'
            THEN 'online' ELSE 'offline'
          END                                          AS status,
          a.client                                     AS client,
          a.site                                       AS site,
          NULLIF(a.logged_in_user, '')                 AS "user",
          NULLIF(a.version, '')                        AS version,
          NULLIF(a.primary_ip, '')                     AS primary_ip
        FROM public.agents a
      ),
      device_rows AS (
        SELECT
          d.id::text            AS id,
          d.hostname            AS hostname,
          d.os                  AS os,
          d.arch                AS arch,
          d.last_seen           AS last_seen,
          d.status              AS status,
          d.client              AS client,
          d.site                AS site,
          NULLIF(d."user", '')  AS "user",
          NULL::text            AS version,
          NULL::text            AS primary_ip
        FROM devices d
        WHERE NOT EXISTS (
          SELECT 1 FROM public.agents a
          WHERE COALESCE(a.hostname, a.device_id, 'unknown') = d.hostname
        )
      ),
      all_devs AS (
        SELECT * FROM agent_rows
        UNION ALL
        SELECT * FROM device_rows
      )
      SELECT id, hostname, os, arch, last_seen, status, client, site, "user", version, primary_ip
      FROM all_devs
      ${whereSql}
      ORDER BY hostname ASC
      LIMIT ${limit} OFFSET ${offset};
    `;

    const { rows } = await this.pg.query(sql, params);
    const hasNext = rows.length > pageSize;

    const items = rows.slice(0, pageSize).map((r: any) => ({
      id: r.id,
      hostname: r.hostname,
      os: r.os,
      arch: r.arch ?? null,
      lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : null,
      status: r.status as "online" | "offline",
      client: r.client ?? null,
      site: r.site ?? null,
      user: r.user ?? null,
      version: r.version ?? null,
      primaryIp: r.primary_ip ?? null,
    })) as Device[];

    return { items, nextCursor: hasNext ? encodeCursor(offset + pageSize) : null };
  }

  async getOne(id: string): Promise<Device | null> {
    const sql = `
      WITH rows AS (
        SELECT
          0                                                AS pref,
          a.id::text                                      AS id,
          COALESCE(a.hostname, a.device_id, 'unknown')    AS hostname,
          COALESCE(NULLIF(a.os, ''), 'unknown')           AS os,
          a.arch                                          AS arch,
          a.last_seen_at                                  AS last_seen,
          CASE
            WHEN a.last_seen_at IS NOT NULL
             AND a.last_seen_at > NOW() - INTERVAL '5 minutes'
            THEN 'online' ELSE 'offline'
          END                                             AS status,
          a.client                                        AS client,
          a.site                                          AS site,
          NULLIF(a.logged_in_user, '')                    AS "user",
          NULLIF(a.version, '')                           AS version,
          NULLIF(a.primary_ip, '')                        AS primary_ip
        FROM public.agents a
        WHERE a.id::text = $1

        UNION ALL

        SELECT
          1                        AS pref,
          d.id::text               AS id,
          d.hostname               AS hostname,
          d.os                     AS os,
          d.arch                   AS arch,
          d.last_seen              AS last_seen,
          d.status                 AS status,
          d.client                 AS client,
          d.site                   AS site,
          NULLIF(d."user", '')     AS "user",
          NULL::text               AS version,
          NULL::text               AS primary_ip
        FROM devices d
        WHERE d.id::text = $1
      )
      SELECT id, hostname, os, arch, last_seen, status, client, site, "user", version, primary_ip
      FROM rows
      ORDER BY pref ASC
      LIMIT 1;
    `;
    const { rows } = await this.pg.query(sql, [id]);
    const r = rows[0];
    if (!r) return null;

    return {
      id: r.id,
      hostname: r.hostname,
      os: r.os,
      arch: r.arch ?? null,
      lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : null,
      status: r.status as "online" | "offline",
      client: r.client ?? null,
      site: r.site ?? null,
      user: r.user ?? null,
      version: r.version ?? null,
      primaryIp: r.primary_ip ?? null,
    };
  }

  async listSoftware(
    id: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      version: string;
      publisher?: string | null;
      installDate?: string | null;
    }>
  > {
    const { rows } = await this.pg.query(
      `
      SELECT
        s.id::text            AS id,
        s.name,
        s.version,
        s.publisher,
        s.install_date        AS install_date
      FROM public.agent_software s
      JOIN public.agents a ON a.id = s.agent_id
      WHERE a.id::text = $1
      ORDER BY lower(s.name) ASC, COALESCE(s.version,'') ASC
      `,
      [id]
    );

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      version: r.version ?? "",
      publisher: r.publisher ?? null,
      installDate: r.install_date ?? null,
    }));
  }

  // NEW: create uninstall job in a simple job queue
  async requestUninstall(
    id: string,
    body: { name: string; version?: string | null }
  ): Promise<string> {
    // ensure agent exists
    const { rows: arows } = await this.pg.query(
      `SELECT id FROM public.agents WHERE id::text = $1`,
      [id]
    );
    const agentId: number | undefined = arows[0]?.id;
    if (!agentId) throw new NotFoundException("Agent not found");

    const payload = {
      action: "uninstall_software",
      name: body.name,
      version: body.version ?? null,
    };

    const { rows } = await this.pg.query(
      `
      INSERT INTO public.agent_jobs (agent_id, kind, payload)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id::text AS id
      `,
      [agentId, "uninstall_software", JSON.stringify(payload)]
    );

    return rows[0].id as string;
  }
}
