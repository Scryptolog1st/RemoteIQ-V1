import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set<string>([
    "/login",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
]);

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Normalize legacy route to the new one
    if (pathname === "/auth/login") {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        // default to home after login
        url.searchParams.set("next", "/");
        return NextResponse.redirect(url);
    }

    // Never run on /login or static assets (avoid loops)
    if (
        pathname === "/login" ||
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/static/") ||
        pathname.startsWith("/images/") ||
        pathname.startsWith("/fonts/")
    ) {
        return NextResponse.next();
    }

    // Allow any frontend /api if you have them
    if (pathname.startsWith("/api/")) {
        return NextResponse.next();
    }

    if (PUBLIC_PATHS.has(pathname)) {
        return NextResponse.next();
    }

    const token = req.cookies.get("auth_token")?.value;

    if (!token) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        // set next to the requested path; it’s sanitized on the login page
        url.searchParams.set("next", pathname || "/");
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|login).*)",
    ],
};
