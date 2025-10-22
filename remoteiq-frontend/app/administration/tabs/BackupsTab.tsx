"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ArchiveRestore } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToastFn, BackupConfig, BackupHistoryRow, BackupTarget } from "../types";
import { LabeledInput, LabeledNumber, CheckToggle } from "../helpers";

interface BackupsTabProps {
    push: ToastFn;
}

export default function BackupsTab({ push }: BackupsTabProps) {
    const [backups, setBackups] = React.useState<BackupConfig>({
        enabled: false,
        targets: ["users", "roles", "devices", "settings"],
        schedule: "daily",
        cronExpr: "0 3 * * *",
        retentionDays: 30,
        encrypt: true,
        destination: { kind: "local" },
    });

    const [backupHistory, setBackupHistory] = React.useState<BackupHistoryRow[]>([
        { id: "b3", at: "2025-10-10 03:00", status: "success", note: "Daily backup" },
        { id: "b2", at: "2025-10-09 03:00", status: "success" },
        { id: "b1", at: "2025-10-08 03:00", status: "failed", note: "S3 permission denied" },
    ]);

    function toggleTarget(t: BackupTarget) {
        setBackups((prev) => ({
            ...prev,
            targets: prev.targets.includes(t) ? prev.targets.filter((x) => x !== t) : [...prev.targets, t],
        }));
    }

    return (
        <TabsContent value="backups" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Backups</CardTitle>
                    <CardDescription>Configure backup targets, schedule, retention and destination.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ArchiveRestore className="h-4 w-4" />
                                <div className="font-medium">Backup Configuration</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch checked={backups.enabled} onCheckedChange={(v) => setBackups({ ...backups, enabled: v })} />
                                <span className="text-sm">{backups.enabled ? "Enabled" : "Disabled"}</span>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-sm">Targets</Label>
                            <div className="flex flex-wrap gap-2 text-sm">
                                {([
                                    "users", "roles", "devices", "policies",
                                    "audit_logs", "settings", "templates"
                                ] as BackupTarget[]).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => toggleTarget(t)}
                                        className={cn(
                                            "rounded border px-2 py-1 capitalize",
                                            backups.targets.includes(t)
                                                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                                : "border-border"
                                        )}
                                    >
                                        {t.replace("_", " ")}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="grid gap-1">
                                <Label className="text-sm">Schedule</Label>
                                <Select
                                    value={backups.schedule}
                                    onValueChange={(v: "hourly" | "daily" | "weekly" | "cron") => setBackups({ ...backups, schedule: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hourly">Hourly</SelectItem>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="cron">Custom (cron)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {backups.schedule === "cron" ? (
                                <LabeledInput label="Cron expression" value={backups.cronExpr} onChange={(v) => setBackups({ ...backups, cronExpr: v })} />
                            ) : (
                                <div className="grid gap-1">
                                    <Label className="text-sm">Next run (example)</Label>
                                    <Input value="Tonight 03:00" readOnly />
                                </div>
                            )}

                            <LabeledNumber label="Retention (days)" value={backups.retentionDays} onChange={(v) => setBackups({ ...backups, retentionDays: v })} />
                        </div>

                        <div className="rounded-md border p-3 space-y-3">
                            <div className="font-medium">Destination</div>
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="grid gap-1">
                                    <Label className="text-sm">Type</Label>
                                    <Select
                                        value={backups.destination.kind}
                                        onValueChange={(v: "local" | "s3") =>
                                            setBackups({ ...backups, destination: v === "local" ? { kind: "local" } : { kind: "s3", bucket: "", prefix: "" } })
                                        }
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="local">Local</SelectItem>
                                            <SelectItem value="s3">S3</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {backups.destination.kind === "s3" && (
                                    <>
                                        <LabeledInput
                                            label="Bucket"
                                            value={backups.destination.bucket}
                                            onChange={(v) => setBackups({ ...backups, destination: { kind: "s3", bucket: v, prefix: (backups.destination as any).prefix ?? "" } })}
                                        />
                                        <LabeledInput
                                            label="Prefix"
                                            value={backups.destination.prefix}
                                            onChange={(v) => setBackups({ ...backups, destination: { kind: "s3", bucket: (backups.destination as any).bucket ?? "", prefix: v } })}
                                        />
                                    </>
                                )}
                            </div>

                            <CheckToggle label="Encrypt backup archives" checked={backups.encrypt} onChange={(v) => setBackups({ ...backups, encrypt: v })} />
                        </div>
                    </div>

                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                            <div className="col-span-3 px-2">ID</div>
                            <div className="col-span-3 px-2">Time</div>
                            <div className="col-span-3 px-2">Status</div>
                            <div className="col-span-3 px-2">Note</div>
                        </div>
                        {backupHistory.map((b) => (
                            <div key={b.id} className="grid grid-cols-12 items-center border-b p-2 last:border-b-0 text-sm">
                                <div className="col-span-3 px-2 font-mono">{b.id}</div>
                                <div className="col-span-3 px-2">{b.at}</div>
                                <div className={cn(
                                    "col-span-3 px-2",
                                    b.status === "success" ? "text-emerald-600" :
                                    b.status === "failed" ? "text-red-600" :
                                    "text-amber-600"
                                )}>
                                    {b.status}
                                </div>
                                <div className="col-span-3 px-2 text-muted-foreground">{b.note ?? "—"}</div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                const id = Math.random().toString(36).slice(2, 8);
                                setBackupHistory((prev) => [{ id, at: new Date().toISOString().slice(0, 16).replace("T", " "), status: "running" }, ...prev]);
                                push({ title: "Backup started", kind: "default" });
                            }}
                        >
                            Run backup now
                        </Button>
                        <Button variant="success" onClick={() => push({ title: "Backup settings saved", kind: "success" })}>
                            Save backup settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
