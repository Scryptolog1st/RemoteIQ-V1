// app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:3001";

function toJSON(obj: unknown) {
    return new NextResponse(JSON.stringify(obj), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

function errorJSON(status: number, message: string, detail?: unknown) {
    return new NextResponse(
        JSON.stringify({ error: message, detail }),
        { status, headers: { "Content-Type": "application/json" } }
    );
}

/** GET /api/roles -> list roles with meta & usersCount */
export async function GET() {
    try {
        const res = await fetch(`${BACKEND}/roles`, {
            // Forward cookies/headers if your backend needs auth: add credentials & headers here.
            // credentials: "include",
            // headers: { cookie: ... }
            cache: "no-store",
        });

        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            return errorJSON(res.status, "Failed to fetch roles", txt);
        }

        // Expect backend returns array like:
        // [{ id, name, description, permissions: string[], usersCount, createdAt, updatedAt }]
        const data = await res.json();
        return toJSON(data);
    } catch (e: any) {
        return errorJSON(500, "Upstream error fetching roles", e?.message);
    }
}

/** POST /api/roles -> create role */
export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();

        // Basic shape check; detailed validation is on the backend.
        if (
            typeof payload?.name !== "string" ||
            !Array.isArray(payload?.permissions)
        ) {
            return errorJSON(400, "Invalid payload");
        }

        const res = await fetch(`${BACKEND}/roles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            return errorJSON(res.status, "Failed to create role", txt);
        }

        const data = await res.json(); // { id }
        return toJSON(data);
    } catch (e: any) {
        return errorJSON(500, "Upstream error creating role", e?.message);
    }
}
