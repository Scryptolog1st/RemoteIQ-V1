// lib/images.ts
const BASE =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "")) || "";

export const AVATAR_PLACEHOLDER = `${BASE}/static/uploads/avatar-placeholder.png`;

/** Returns a safe image src for user avatars */
export function getAvatarSrc(avatarUrl?: string | null): string {
    if (!avatarUrl) return AVATAR_PLACEHOLDER;
    // If backend sent a relative path, prefix with BASE
    if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
    return `${BASE}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;
}
