// app/api/roles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:3001";

function ok() {
    return new NextResponse(null, { status: 204 });
}
function errorJSON(status: number, message: string, detail?: unknown) {
    return new NextResponse(
        JSON.stringify({ error: message, detail }),
        { status, headers: { "Content-Type": "application/json" } }
    );
}

/** PATCH /api/roles/:id -> update role */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const patch = await req.json();

        const res = await fetch(`${BACKEND}/roles/${params.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });

        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            return errorJSON(res.status, "Failed to update role", txt);
        }
        // Assume backend returns 204 or 200; normalize to 204.
        return ok();
    } catch (e: any) {
        return errorJSON(500, "Upstream error updating role", e?.message);
    }
}

/** DELETE /api/roles/:id -> delete role */
export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const res = await fetch(`${BACKEND}/roles/${params.id}`, {
            method: "DELETE",
        });

        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            return errorJSON(res.status, "Failed to delete role", txt);
        }
        return ok();
    } catch (e: any) {
        return errorJSON(500, "Upstream error deleting role", e?.message);
    }
}
