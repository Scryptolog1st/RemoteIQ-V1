//backend\src\users\me.controller.ts

import {
    Controller,
    Get,
    Patch,
    Body,
    UseInterceptors,
    UploadedFile,
    Post,
    Delete,
    Req,
    BadRequestException,
    UnauthorizedException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import type { Request } from "express";
import { MeService } from "./me.service";

/* ----------------------------- MIME → EXT map ----------------------------- */
const EXT_BY_MIME: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
};

/* ----------------------------- Rate limit (simple) ----------------------------- */
/** Allow one upload per user every 5 seconds (in-memory, per-instance). */
const UPLOAD_RATE_MS = 5_000;
const lastUploadByUser = new Map<string, number>();

/* ----------------------------- Multer callbacks ----------------------------- */
/** filename: (req, file, cb: (err: Error|null, filename: string) => void) => void */
function filenameCb(
    _req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void,
) {
    // derive extension from mime for consistency and safety
    const ext = EXT_BY_MIME[file.mimetype] ?? ".bin";
    // remove suspicious chars from provided name (if we keep it), and trim to avoid gigantic filenames
    const base =
        (file.originalname || "upload")
            .replace(/[^\w.\-]+/g, "_")
            .replace(/\.[A-Za-z0-9]+$/, "") // strip user-provided extension
            .slice(0, 80) || "upload";
    const safe = `${Date.now()}_${base}${ext}`;
    callback(null, safe);
}

/** fileFilter: (req, file, cb: (err: Error|null, accept: boolean) => void) => void */
function imageFilter(
    _req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
) {
    const ok = !!EXT_BY_MIME[file.mimetype];
    if (!ok) return callback(new BadRequestException("Unsupported file type"), false);
    return callback(null, true);
}

/* ----------------------------- URL Builder ----------------------------- */
/**
 * Build an ABSOLUTE URL to the static mount that always works and never double-prefixes.
 * Rules:
 * - If PUBLIC_BASE_URL is set, use it as the host origin (no trailing slash).
 * - Otherwise derive protocol/host from the request.
 * - Ensure exactly one '/static' segment before '/uploads/...'.
 *
 * Examples that all yield a single '/static/uploads/...':
 *   PUBLIC_BASE_URL=http://localhost:3001         -> http://localhost:3001/static/uploads/<file>
 *   PUBLIC_BASE_URL=http://localhost:3001/static  -> http://localhost:3001/static/uploads/<file>
 *   PUBLIC_BASE_URL not set                       -> http(s)://<req host>/static/uploads/<file>
 */
function buildStaticUploadUrl(req: Request, filename: string): string {
    const raw = (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, ""); // strip trailing '/'
    let origin: string;
    if (raw) {
        // If the env already ends with '/static', keep it; else append '/static'
        const staticBase = raw.endsWith("/static") ? raw : `${raw}/static`;
        origin = staticBase;
    } else {
        // derive from request
        const proto =
            (req.headers["x-forwarded-proto"] as string) ||
            (req.protocol || "http");
        const host = req.get("host") || "localhost:3001";
        origin = `${proto}://${host}/static`;
    }
    return `${origin}/uploads/${encodeURIComponent(filename)}`;
}

@Controller("/api/users")
export class MeController {
    constructor(private readonly me: MeService) { }

    // Current user profile
    @Get("me")
    async getMe(@Req() req: any) {
        const userId = req.user?.id; // set by your cookie middleware
        if (!userId) throw new UnauthorizedException("Not authenticated");
        return this.me.getMe(userId);
    }

    // Partial update
    @Patch("me")
    async patchMe(@Req() req: any, @Body() body: any) {
        const userId = req.user?.id;
        if (!userId) throw new UnauthorizedException("Not authenticated");
        return this.me.updateMe(userId, body);
    }

    // Upload avatar (multipart/form-data; field name: "file")
    @Post("me/avatar")
    @UseInterceptors(
        FileInterceptor("file", {
            storage: diskStorage({
                destination: "public/uploads",
                filename: filenameCb,
            }),
            limits: {
                fileSize: Math.max(
                    1,
                    (Number(process.env.AVATAR_MAX_MB) || 5) * 1024 * 1024,
                ), // default 5 MB
            },
            fileFilter: imageFilter,
        }),
    )
    async uploadAvatar(@Req() req: Request & { user?: any }, @UploadedFile() file: Express.Multer.File) {
        const userId = req.user?.id;
        if (!userId) throw new UnauthorizedException("Not authenticated");
        if (!file) throw new BadRequestException("No file uploaded");

        // rate-limit: N ms between uploads per user
        const now = Date.now();
        const last = lastUploadByUser.get(userId) || 0;
        if (now - last < UPLOAD_RATE_MS) {
            throw new BadRequestException("You're uploading too fast. Please wait a moment and try again.");
        }
        lastUploadByUser.set(userId, now);

        // Build a correct, absolute URL that points to ServeStatic '/static'
        const url = buildStaticUploadUrl(req, file.filename);

        // Save in DB; also sets avatar_thumb_url (same as main for now) and deletes previous local file if any
        await this.me.replaceAvatarUrl(userId, url);

        return { url };
    }

    // Remove avatar
    @Delete("me/avatar")
    async deleteAvatar(@Req() req: any) {
        const userId = req.user?.id;
        if (!userId) throw new UnauthorizedException("Not authenticated");

        await this.me.replaceAvatarUrl(userId, null);
        return { ok: true };
    }
}
