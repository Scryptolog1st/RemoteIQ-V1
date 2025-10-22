"use client";
import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getAuditEvents, type AuditEvent } from "@/lib/account-api";

export function AuditPanel({ section }: { section: string }) {
    const [events, setEvents] = React.useState<AuditEvent[] | null>(null);
    const [err, setErr] = React.useState<string | null>(null);

    React.useEffect(() => {
        getAuditEvents(section).then(setEvents).catch(() => setErr("Failed to load activity"));
    }, [section]);

    return (
        <Card className="md:col-span-1">
            <CardHeader>
                <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {err && <div className="rounded border p-2 text-xs text-amber-700 bg-amber-50">{err}</div>}
                {!events && !err && <div className="h-20 animate-pulse rounded bg-muted" />}
                {events?.length === 0 && <div className="text-sm text-muted-foreground">No recent changes.</div>}
                {events?.map((e) => (
                    <div key={e.id} className="rounded border p-2 text-xs">
                        <div className="font-medium">{e.action}</div>
                        <div className="opacity-70">{new Date(e.at).toLocaleString()}</div>
                        <div className="mt-1 break-words">{e.details}</div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
