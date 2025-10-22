// components/checks-and-alerts-tab.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
    Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, OctagonX } from "lucide-react";
import { fetchDeviceChecks, type DeviceCheck } from "@/lib/api";

/* --------------------------- palette + glyphs --------------------------- */
type CheckStatus = "Passing" | "Failing" | "Warning";
const STATUS_META: Record<
    CheckStatus,
    {
        icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
        text: string;
        chipBg: string;
        ring: string;
        badgeBg: string;
        badgeText: string;
    }
> = {
    Passing: {
        icon: CheckCircle2,
        text: "text-emerald-500",
        chipBg: "bg-emerald-500/15",
        ring: "ring-emerald-500/25",
        badgeBg: "bg-emerald-500",
        badgeText: "text-white",
    },
    Warning: {
        icon: AlertTriangle,
        text: "text-amber-500",
        chipBg: "bg-amber-500/15",
        ring: "ring-amber-500/25",
        badgeBg: "bg-amber-500",
        badgeText: "text-black",
    },
    Failing: {
        icon: OctagonX,
        text: "text-red-500",
        chipBg: "bg-red-500/15",
        ring: "ring-red-500/25",
        badgeBg: "bg-red-500",
        badgeText: "text-white",
    },
};

function StatusGlyph({
    status,
    size = 18,
    className = "",
}: {
    status: CheckStatus;
    size?: number;
    className?: string;
}) {
    const s = STATUS_META[status];
    const Icon = s.icon;
    return (
        <span
            className={[
                "inline-flex items-center justify-center rounded-md p-1 ring-1",
                s.chipBg,
                s.ring,
                className,
            ].join(" ")}
            aria-hidden="true"
        >
            <Icon width={size} height={size} className={s.text} />
        </span>
    );
}

function StatusCountBadge({
    status,
    children,
    title,
    size = "md",
}: {
    status: CheckStatus;
    children: React.ReactNode;
    title?: string;
    size?: "sm" | "md" | "lg";
}) {
    const s = STATUS_META[status];
    const sizeClasses =
        size === "lg"
            ? "h-8 min-w-[2.25rem] px-2.5 text-sm font-semibold"
            : size === "sm"
                ? "h-5 min-w-[1.25rem] px-1.5 text-[11px]"
                : "h-6 min-w-[1.5rem] px-2 text-xs font-medium";
    return (
        <span
            title={title}
            className={[
                "inline-flex items-center justify-center rounded-full",
                sizeClasses,
                s.badgeBg,
                s.badgeText,
                "shadow-sm ring-1 ring-black/5 dark:ring-white/5",
            ].join(" ")}
        >
            {children}
        </span>
    );
}

/* -------------------------------- component ------------------------------- */

export default function ChecksAndAlertsTab() {
    const params = useParams<{ deviceId: string }>();
    const deviceId = params?.deviceId;

    const [items, setItems] = React.useState<DeviceCheck[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let alive = true;
        (async () => {
            if (!deviceId) return;
            setLoading(true); setError(null);
            try {
                const { items } = await fetchDeviceChecks(deviceId);
                if (!alive) return;
                setItems(items);
            } catch (e: any) {
                if (!alive) return;
                setError(e?.message ?? "Failed to load checks");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [deviceId]);

    const failingChecks = items.filter((c) => c.status === "Failing").length;
    const warningChecks = items.filter((c) => c.status === "Warning").length;

    return (
        <div className="grid gap-6">
            <div className="grid md:grid-cols-2 gap-6">
                {/* Active Alerts */}
                <Card>
                    <CardHeader>
                        <CardTitle>Active Alerts</CardTitle>
                        <CardDescription>A summary of checks that require attention.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {/* Failing */}
                        <div className="flex items-center justify-between p-4 rounded-lg ring-1 ring-red-500/25 bg-red-500/10">
                            <div className="flex items-center gap-4">
                                <StatusGlyph status="Failing" className="scale-110" />
                                <div>
                                    <p className="font-semibold">
                                        {failingChecks} Failing Check{failingChecks !== 1 && "s"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Immediate attention required.</p>
                                </div>
                            </div>
                            <StatusCountBadge status="Failing" size="lg" title="Failing count">
                                {failingChecks}
                            </StatusCountBadge>
                        </div>

                        {/* Warning */}
                        <div className="flex items-center justify-between p-4 rounded-lg ring-1 ring-amber-500/25 bg-amber-500/10">
                            <div className="flex items-center gap-4">
                                <StatusGlyph status="Warning" className="scale-110" />
                                <div>
                                    <p className="font-semibold">
                                        {warningChecks} Warning Check{warningChecks !== 1 && "s"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Potential issues detected.</p>
                                </div>
                            </div>
                            <StatusCountBadge status="Warning" size="lg" title="Warning count">
                                {warningChecks}
                            </StatusCountBadge>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary placeholder */}
                <Card>
                    <CardHeader>
                        <CardTitle>Checks Summary</CardTitle>
                        <CardDescription>Overview of all monitored checks on this device.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
                        {error && <div className="text-sm text-red-600">{error}</div>}
                        {!loading && !error && items.length === 0 && (
                            <div className="text-sm text-muted-foreground">No checks found.</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* History */}
            <Card>
                <CardHeader>
                    <CardTitle>Check History</CardTitle>
                    <CardDescription>A log of the most recent check results.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Check Name</TableHead>
                                <TableHead>Last Run</TableHead>
                                <TableHead>Output</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((check) => (
                                <TableRow key={check.id}>
                                    <TableCell>
                                        <StatusGlyph status={check.status as CheckStatus} />
                                    </TableCell>
                                    <TableCell className="font-medium">{check.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{check.lastRun}</TableCell>
                                    <TableCell className="text-muted-foreground">{check.output}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
