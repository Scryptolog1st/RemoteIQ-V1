// backend/src/users/users.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import {
    BulkInviteDto,
    CreateUserDto,
    InviteUserDto,
    ListUsersQuery,
    ResetPasswordDto,
    UpdateRoleDto,
    UpdateUserDto,
    UserRow,
} from "./users.dto";
import * as bcrypt from "bcryptjs";

function mapUserRow(r: any): UserRow {
    return {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        status: r.status,
        twoFactorEnabled: r.two_factor_enabled,
        lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : null,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),

        // Profile fields (nullable)
        phone: r.phone ?? null,
        address1: r.address1 ?? null,
        address2: r.address2 ?? null,
        city: r.city ?? null,
        state: r.state ?? null,
        postal: r.postal ?? null,
        country: r.country ?? null,

        // Avatars (nullable)
        avatarUrl: r.avatar_url ?? null,
        avatarThumbUrl: r.avatar_thumb_url ?? null,
    };
}

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
    // removed cache; always read schema live so runtime migrations are seen
    constructor(private readonly pg: PgPoolService) { }

    private async getUserColumns(): Promise<Set<string>> {
        const { rows } = await this.pg.query(
            `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
    `
        );
        return new Set(rows.map((r: any) => r.column_name));
    }

    async list(q: ListUsersQuery): Promise<{ items: UserRow[]; total: number }> {
        const params: any[] = [];
        const where: string[] = [];

        if (q.q) {
            params.push(`%${q.q.toLowerCase()}%`);
            where.push(
                `(LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`
            );
        }
        if (q.role && q.role !== "all") {
            params.push(q.role);
            where.push(`role = $${params.length}`);
        }
        if (q.status && q.status !== "all") {
            params.push(q.status);
            where.push(`status = $${params.length}`);
        }
        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const sortKeyMap: Record<string, string> = {
            name: "name",
            email: "email",
            role: "role",
            lastSeen: "last_seen",
        };
        const sortCol = sortKeyMap[q.sortKey] ?? "name";
        const sortDir = q.sortDir?.toUpperCase() === "DESC" ? "DESC" : "ASC";

        const page = Math.max(1, q.page ?? 1);
        const pageSize = Math.max(1, q.pageSize ?? 25);
        const offset = (page - 1) * pageSize;

        const countSql = `SELECT COUNT(*) AS c FROM users ${whereSql}`;
        const { rows: countRows } = await this.pg.query(countSql, params);
        const total = Number(countRows[0]?.c ?? 0);

        const dataSql = `
      SELECT
        id,
        name,
        email,
        role,
        status,
        two_factor_enabled,
        last_seen,
        created_at,
        updated_at,

        -- profile fields
        phone,
        address1,
        address2,
        city,
        state,
        postal,
        country,

        -- avatar fields
        avatar_url,
        avatar_thumb_url

      FROM users
      ${whereSql}
      ORDER BY ${sortCol} ${sortDir}, name ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
        const { rows } = await this.pg.query(dataSql, [...params, pageSize, offset]);
        return { items: rows.map(mapUserRow), total };
    }

    async roles(): Promise<{ id: string; name: string }[]> {
        const { rows } = await this.pg.query(
            `SELECT id, name FROM roles ORDER BY name ASC`
        );
        return rows;
    }

    async inviteOne(dto: InviteUserDto): Promise<{ id: string }> {
        const name = dto.name?.trim() || dto.email.split("@")[0];
        const role = dto.role?.trim() || "User";
        const { rows } = await this.pg.query(
            `INSERT INTO users (name, email, role, status)
       VALUES ($1, $2, $3, 'invited')
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role
       RETURNING id`,
            [name, dto.email, role]
        );
        return { id: rows[0]?.id ?? "" };
    }

    async inviteBulk(dto: BulkInviteDto): Promise<{ created: number }> {
        let created = 0;
        for (const inv of dto.invites || []) {
            const res = await this.inviteOne(inv);
            if (res.id) created++;
        }
        return { created };
    }

    async updateRole(id: string, dto: UpdateRoleDto): Promise<void> {
        const { rows } = await this.pg.query(
            `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
            [id, dto.role]
        );
        if (rows.length === 0) throw new NotFoundException("User not found");
    }

    async setSuspended(id: string, suspended: boolean): Promise<void> {
        const status = suspended ? "suspended" : "active";
        const { rows } = await this.pg.query(
            `UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
            [id, status]
        );
        if (rows.length === 0) throw new NotFoundException("User not found");
    }

    async reset2fa(id: string): Promise<void> {
        const { rows } = await this.pg.query(
            `UPDATE users SET two_factor_enabled = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) throw new NotFoundException("User not found");
    }

    async remove(id: string): Promise<void> {
        const { rows } = await this.pg.query(
            `DELETE FROM users WHERE id = $1 RETURNING id`,
            [id]
        );
        if (rows.length === 0) throw new NotFoundException("User not found");
    }

    async createOne(dto: CreateUserDto): Promise<{ id: string }> {
        const name = dto.name.trim();
        const email = dto.email.toLowerCase().trim();
        const role = (dto.role?.trim() || "User") as string;
        const status = dto.status ?? "active";

        const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

        const { rows } = await this.pg.query(
            `INSERT INTO users (name, email, role, status, password_hash, password_updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         status = EXCLUDED.status,
         password_hash = EXCLUDED.password_hash,
         password_updated_at = EXCLUDED.password_updated_at
       RETURNING id`,
            [name, email, role, status, hash]
        );

        return { id: rows[0]?.id ?? "" };
    }

    async setPassword(id: string, body: ResetPasswordDto): Promise<void> {
        const hash = await bcrypt.hash(body.password, SALT_ROUNDS);
        const { rows } = await this.pg.query(
            `UPDATE users
         SET password_hash = $2,
             password_updated_at = NOW(),
             updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
            [id, hash]
        );
        if (rows.length === 0) throw new NotFoundException("User not found");
    }

    async updateUser(id: string, dto: UpdateUserDto): Promise<void> {
        const cols = await this.getUserColumns();

        const fieldMap: Record<string, string> = {
            name: "name",
            email: "email",
            role: "role",
            phone: "phone",
            address1: "address1",
            address2: "address2",
            city: "city",
            state: "state",
            postal: "postal",
            country: "country",
            // if you decide to allow admin to change avatars here, you could include:
            // avatarUrl: "avatar_url",
            // avatarThumbUrl: "avatar_thumb_url",
        };

        const sets: string[] = [];
        const params: any[] = [id];

        Object.entries(dto).forEach(([k, v]) => {
            const col = fieldMap[k];
            if (v !== undefined && col && cols.has(col)) {
                params.push(v);
                sets.push(`${col} = $${params.length}`);
            }
        });

        if (sets.length === 0) {
            const { rows } = await this.pg.query(`SELECT id FROM users WHERE id = $1`, [id]);
            if (rows.length === 0) throw new NotFoundException("User not found");
            return;
        }

        const sql = `
      UPDATE users
      SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
        const { rows } = await this.pg.query(sql, params);
        if (rows.length === 0) throw new NotFoundException("User not found");
    }
}
