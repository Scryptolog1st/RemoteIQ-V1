"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastFn, AuditLog, AuditCategory, AuditSeverity } from "../types";

interface AuditTabProps {
    push: ToastFn;
}

const CATEGORY_LABELS: Record<AuditCategory, string> = {
    security: "Security",
    role: "Role Changes",
    user: "User Management",
    auth: "Authentication",
    email: "Email",
    device: "Devices",
    system: "System",
};
const SEVERITY_LABELS: Record<AuditSeverity, string> = { info: "Info", warning: "Warning", error: "Error" };
const ORDERED_CATEGORIES: AuditCategory[] = ["security", "role", "user", "auth", "email", "device", "system"];

export default function AuditTab({ push }: AuditTabProps) {
    const [auditLogs] = React.useState<AuditLog[]>([
        { id: "a1", at: "2025-10-09 10:32", category: "user", severity: "warning", actor: "Admin", action: "User removed", details: "Removed chris@example.com" },
        { id: "a2", at: "2025-10-08 14:11", category: "role", severity: "info", actor: "System", action: "Role changed", details: "Jamie Lee → Admin" },
        { id: "a3", at: "2025-10-08 09:02", category: "auth", severity: "info", actor: "Alex Morgan", action: "Login", details: "IP 73.184.10.22" },
        { id: "a4", at: "2025-10-07 18:44", category: "email", severity: "error", actor: "Notifier", action: "Email send failed", details: "SMTP time-out for alerts@your-msp.com" },
        { id: "a5", at: "2025-10-07 12:05", category: "device", severity: "warning", actor: "PolicyEngine", action: "Patch policy skipped", details: "Outside maintenance window" },
        { id: "a6", at: "2025-10-06 21:10", category: "system", severity: "info", actor: "Admin", action: "Region changed", details: "Default region → US East" },
        { id: "a7", at: "2025-10-06 08:55", category: "security", severity: "error", actor: "AuthGuard", action: "Rate limited", details: "Excessive login attempts on jlee@example.com" },
    ]);

    const [auditQuery, setAuditQuery] = React.useState("");
    const [auditCategory, setAuditCategory] = React.useState<"all" | AuditCategory>("all");
    const [auditSeverity, setAuditSeverity] = React.useState<"all" | AuditSeverity>("all");
    const [auditFrom, setAuditFrom] = React.useState<string>("");
    const [auditTo, setAuditTo] = React.useState<string>("");

    const filteredAudit = React.useMemo(() => {
        const fromMs = auditFrom ? new Date(auditFrom).getTime() : null;
        const toMs = auditTo ? new Date(auditTo).getTime() + 24 * 60 * 60 * 1000 : null;
        const q = auditQuery.trim().toLowerCase();

        return auditLogs.filter((log) => {
            if (auditCategory !== "all" && log.category !== auditCategory) return false;
            if (auditSeverity !== "all" && log.severity !== auditSeverity) return false;

            const ts = Date.parse(log.at);
            if (!Number.isNaN(ts)) {
                if (fromMs && ts < fromMs) return false;
                if (toMs && ts >= toMs) return false;
            }

            if (!q) return true;
            const hay = `${log.action} ${log.details ?? ""} ${log.actor} ${log.category} ${log.severity}`.toLowerCase();
            return hay.includes(q);
        });
    }, [auditLogs, auditQuery, auditCategory, auditSeverity, auditFrom, auditTo]);

    const groupedAudit = React.useMemo(() => {
        return filteredAudit.reduce((acc, log) => {
            (acc[log.category] ||= []).push(log);
            return acc;
        }, {} as Record<AuditCategory, AuditLog[]>);
    }, [filteredAudit]);

    function exportAuditCsv() {
        const headers = ["id", "at", "category", "severity", "actor", "action", "details"];
        const rows = [headers.join(",")].concat(
            filteredAudit.map((l) =>
                [
                    l.id,
                    `"${l.at}"`,
                    l.category,
                    l.severity,
                    `"${l.actor.replaceAll('"', '""')}"`,
                    `"${l.action.replaceAll('"', '""')}"`,
                    `"${(l.details ?? "").replaceAll('"', '""')}"`,
                ].join(",")
            )
        );
        const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs.csv`;
        a.click();
        URL.revokeObjectURL(url);
        push({ title: "Audit log export started", kind: "success" });
    }

    return (
        <TabsContent value="audit" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Audit Logs</CardTitle>
                    <CardDescription>Search and filter by category, severity, and date.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="rounded-md border p-3">
                        <div className="grid gap-3 md:grid-cols-5 items-end">
                            <div className="md:col-span-2">
                                <Label className="text-sm" htmlFor="audit-search">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input id="audit-search" placeholder="Search action, details, actor…" className="pl-8" value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <Label className="text-sm">Category</Label>
                                <Select value={auditCategory} onValueChange={(v) => setAuditCategory(v as any)}>
                                    <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {ORDERED_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm">Severity</Label>
                                <Select value={auditSeverity} onValueChange={(v) => setAuditSeverity(v as any)}>
                                    <SelectTrigger><SelectValue placeholder="All severities" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="info">Info</SelectItem>
                                        <SelectItem value="warning">Warning</SelectItem>
                                        <SelectItem value="error">Error</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-sm" htmlFor="audit-from">From</Label>
                                    <Input id="audit-from" type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} />
                                </div>
                                <div>
                                    <Label className="text-sm" htmlFor="audit-to">To</Label>
                                    <Input id="audit-to" type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-end">
                            <Button variant="outline" onClick={exportAuditCsv}>Export CSV</Button>
                        </div>
                    </div>

                    {filteredAudit.length === 0 ? (
                        <div className="rounded-md border p-6 text-sm text-muted-foreground">No audit events match your filters.</div>
                    ) : (
                        <div className="space-y-6">
                            {ORDERED_CATEGORIES.map((cat) => {
                                const logs = groupedAudit[cat] ?? [];
                                if (!logs.length) return null;
                                return (
                                    <section key={cat} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold">{CATEGORY_LABELS[cat]}</div>
                                            <div className="text-xs text-muted-foreground">{logs.length} event{logs.length !== 1 ? "s" : ""}</div>
                                        </div>

                                        <div className="space-y-2">
                                            {logs.map((e) => (
                                                <div key={e.id} className="rounded-md border p-3 text-sm">
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-medium">{e.action}</div>
                                                        <div className="text-xs text-muted-foreground">{e.at}</div>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                        <span className="rounded border px-1.5 py-0.5">{CATEGORY_LABELS[e.category]}</span>
                                                        <span
                                                            className={cn(
                                                                "rounded border px-1.5 py-0.5",
                                                                e.severity === "error"
                                                                    ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                                                                    : e.severity === "warning"
                                                                        ? "border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20"
                                                                        : "border-muted bg-muted/20"
                                                            )}
                                                        >
                                                            {SEVERITY_LABELS[e.severity]}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            Actor: <span className="font-medium">{e.actor}</span>
                                                        </span>
                                                    </div>
                                                    {e.details && <div className="mt-2 text-muted-foreground">{e.details}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
    );
}
