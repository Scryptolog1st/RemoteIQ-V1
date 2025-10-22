import { Injectable } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import * as fs from "fs/promises";
import * as path from "path";

@Injectable()
export class MeService {
    constructor(private readonly pg: PgPoolService) { }

    // Compose a public URL for files served from /public (not used by controller anymore, but kept for compatibility)
    makePublicUrl(filename: string) {
        const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
        const staticBase = base ? (base.endsWith("/static") ? base : `${base}/static`) : "";
        return staticBase ? `${staticBase}/uploads/${filename}` : `/static/uploads/${filename}`;
    }

    /* ------------------------------ Helpers for local file cleanup ------------------------------ */

    /** Extract a local filesystem path for files under `/static/uploads/<name>` or `/uploads/<name>` */
    private toLocalUploadPathFromUrl(url?: string | null): string | null {
        if (!url) return null;
        let pathname = "";
        try {
            // absolute http(s) url
            const u = new URL(url);
            pathname = u.pathname;
        } catch {
            // not a full URL; treat as pathname-like
            pathname = url;
        }

        // Normalize where '/uploads/...' might appear (with or without /static prefix)
        const idx = pathname.indexOf("/uploads/");
        if (idx === -1) return null;

        const filename = pathname.substring(idx + "/uploads/".length);
        if (!filename || filename.includes("..")) return null;

        // Resolve to <project>/public/uploads/<filename>
        const uploadsDir = path.join(__dirname, "..", "public", "uploads");
        const abs = path.join(uploadsDir, filename);

        // Ensure file stays inside uploads dir (avoid traversal)
        const normUploads = path.normalize(uploadsDir + path.sep);
        const normFile = path.normalize(abs);
        if (!normFile.startsWith(normUploads)) return null;

        return normFile;
    }

    private async tryDeleteLocalFile(filePath: string | null) {
        if (!filePath) return;
        try {
            await fs.unlink(filePath);
        } catch {
            // swallow (file may not exist or we lack perms; not fatal)
        }
    }

    /* ------------------------------------ Profile CRUD ------------------------------------ */

    async getMe(userId: string) {
        const q = `
      select id, name, email,
             coalesce(phone, '') as phone,
             coalesce(timezone, '') as timezone,
             coalesce(locale, '') as locale,
             coalesce(avatar_url, '') as "avatarUrl",
             coalesce(avatar_thumb_url, '') as "avatarThumbUrl",
             coalesce(address1, '') as address1,
             coalesce(address2, '') as address2,
             coalesce(city, '') as city,
             coalesce(state, '') as state,
             coalesce(postal, '') as postal,
             coalesce(country, '') as country
      from users
      where id = $1
      limit 1
    `;
        const { rows } = await this.pg.query(q, [userId]);
        return rows[0] || {};
    }

    async updateMe(userId: string, patch: Record<string, any>) {
        // Only accept known columns; convert avatarUrl -> avatar_url
        const map: Record<string, string> = {
            name: "name",
            email: "email",
            phone: "phone",
            timezone: "timezone",
            locale: "locale",
            avatarUrl: "avatar_url",
            address1: "address1",
            address2: "address2",
            city: "city",
            state: "state",
            postal: "postal",
            country: "country",
        };

        const sets: string[] = [];
        const vals: any[] = [];
        let i = 1;

        for (const [k, v] of Object.entries(patch || {})) {
            const col = map[k];
            if (!col) continue;
            sets.push(`${col} = $${i++}`);
            vals.push(v);
            // keep thumb in sync if avatarUrl is set directly through PATCH
            if (col === "avatar_url") {
                sets.push(`avatar_thumb_url = $${i++}`);
                vals.push(v);
            }
        }
        if (sets.length === 0) {
            return this.getMe(userId);
        }
        vals.push(userId);

        const sql = `update users set ${sets.join(", ")}, updated_at = now() where id = $${i} returning id`;
        await this.pg.query(sql, vals);
        return this.getMe(userId);
    }

    /**
     * Replace avatar URLs and delete the previous local file (if any and if it was under /uploads).
     * If `nextUrl` is null, clears both avatar fields and removes old local file.
     */
    async replaceAvatarUrl(userId: string, nextUrl: string | null) {
        // first, read previous urls
        const { rows: prevRows } = await this.pg.query<{ avatar_url: string | null; avatar_thumb_url: string | null }>(
            `select avatar_url, avatar_thumb_url from users where id = $1 limit 1`,
            [userId],
        );
        const prev = prevRows[0] || { avatar_url: null, avatar_thumb_url: null };

        // upsert new URL(s); for now thumb mirrors the main url
        await this.pg.query(
            `update users
         set avatar_url = $2,
             avatar_thumb_url = $3,
             updated_at = now()
       where id = $1`,
            [userId, nextUrl, nextUrl],
        );

        // delete the previous local file if it lived under /uploads and is different than new
        const oldUrl = prev.avatar_url;
        if (oldUrl && oldUrl !== nextUrl) {
            const localPath = this.toLocalUploadPathFromUrl(oldUrl);
            await this.tryDeleteLocalFile(localPath);
        }

        // return updated profile
        return this.getMe(userId);
    }

    /** Kept for compatibility with earlier calls; now delegates to replaceAvatarUrl */
    async setAvatarUrl(userId: string, url: string | null) {
        return this.replaceAvatarUrl(userId, url);
    }
}
