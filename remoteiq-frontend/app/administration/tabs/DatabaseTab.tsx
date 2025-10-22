"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import { LabeledInput, LabeledNumber, LabeledSelect, CheckToggle, SettingCard } from "../helpers";
import type { ToastFn } from "../types";
import {
    type DatabaseConfig,
    type DbEngine,
    type DbAuthMode,
    type StorageDomain,
    getDatabaseConfig,
    testDatabaseConfig,
    saveDatabaseConfig,
    dryRunDatabaseMigration,
} from "@/lib/api";

type Props = { push: ToastFn };

const DOMAINS: StorageDomain[] = ["users", "roles", "sessions", "audit_logs", "devices", "policies", "email_queue"];

const ENGINE_OPTIONS = [
    { value: "postgresql", label: "PostgreSQL (recommended)" },
    { value: "mysql", label: "MySQL / MariaDB" },
    { value: "mssql", label: "SQL Server" },
    { value: "sqlite", label: "SQLite" },
    { value: "mongodb", label: "MongoDB" },
] as const;

const AUTH_OPTIONS = [
    { value: "url", label: "Connection URL" },
    { value: "fields", label: "Host / Port / User / Pass" },
] as const;

const DEFAULT_CFG: DatabaseConfig = {
    enabled: false,
    engine: "postgresql",
    authMode: "url",
    url: "",
    host: "",
    port: 5432,
    dbName: "",
    username: "",
    password: "",
    ssl: false,
    poolMin: 0,
    poolMax: 10,
    readReplicas: "",
    mappings: {
        users: "users",
        roles: "roles",
        sessions: "sessions",
        audit_logs: "audit_logs",
        devices: "devices",
        policies: "policies",
        email_queue: "email_queue",
    },
};

export default function DatabaseTab({ push }: Props) {
    const [cfg, setCfg] = React.useState<DatabaseConfig>(DEFAULT_CFG);
    const [loading, setLoading] = React.useState(false);
    const [testing, setTesting] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [dryRunning, setDryRunning] = React.useState(false);

    React.useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            try {
                const res = await getDatabaseConfig();
                if (!alive) return;
                if ("enabled" in res && res.enabled === false) {
                    setCfg(DEFAULT_CFG);
                } else {
                    const merged: DatabaseConfig = {
                        ...DEFAULT_CFG,
                        ...(res as DatabaseConfig),
                        mappings: { ...DEFAULT_CFG.mappings, ...(res as DatabaseConfig).mappings },
                    };
                    setCfg(merged);
                }
            } catch (e: any) {
                push({ title: "Failed to load database settings", desc: e?.message, kind: "destructive" });
            } finally {
                setLoading(false);
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function upd<K extends keyof DatabaseConfig>(key: K, value: DatabaseConfig[K]) {
        setCfg((prev) => ({ ...prev, [key]: value }));
    }
    function updMapping(domain: StorageDomain, table: string) {
        setCfg((prev) => ({ ...prev, mappings: { ...prev.mappings, [domain]: table } }));
    }

    async function onTest() {
        setTesting(true);
        try {
            const res = await testDatabaseConfig(cfg);
            if (res.ok) {
                push({ title: "Connection OK", desc: `Connectivity OK (${res.engine})`, kind: "success" });
            } else {
                push({ title: "Connection failed", desc: res?.primary?.message || "See server logs", kind: "destructive" });
            }
        } catch (e: any) {
            push({ title: "Test failed", desc: e?.message, kind: "destructive" });
        } finally {
            setTesting(false);
        }
    }

    async function onSave() {
        setSaving(true);
        try {
            if (cfg.authMode === "url") {
                if (!cfg.url?.trim()) { push({ title: "Validation error", desc: "URL is required", kind: "warning" }); setSaving(false); return; }
            } else {
                if (!cfg.host?.trim() || !cfg.dbName?.trim() || !cfg.username?.trim()) {
                    push({ title: "Validation error", desc: "Host, Database and Username are required", kind: "warning" });
                    setSaving(false);
                    return;
                }
            }
            await saveDatabaseConfig(cfg);
            push({ title: "Saved", desc: "Database configuration updated", kind: "success" });
        } catch (e: any) {
            push({ title: "Save failed", desc: e?.message, kind: "destructive" });
        } finally {
            setSaving(false);
        }
    }

    async function onDryRun() {
        setDryRunning(true);
        try {
            const plan = await dryRunDatabaseMigration();
            push({ title: "Dry-run complete", desc: plan.steps?.join(" • ").slice(0, 180) || "No steps", kind: "success" });
        } catch (e: any) {
            push({ title: "Dry-run failed", desc: e?.message, kind: "destructive" });
        } finally {
            setDryRunning(false);
        }
    }

    return (
        <TabsContent value="database" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Database</CardTitle>
                    <CardDescription>Configure your external database connection.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <SettingCard icon={<span />} title="Enable external database" desc="Use an external DB instead of in-memory data.">
                        <CheckToggle label="Enabled" checked={!!cfg.enabled} onChange={(v) => upd("enabled", v)} />
                    </SettingCard>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <LabeledSelect label="Engine" value={cfg.engine} onChange={(v) => upd("engine", v as DbEngine)} options={ENGINE_OPTIONS as any} />
                        <LabeledSelect label="Auth Mode" value={cfg.authMode} onChange={(v) => upd("authMode", v as DbAuthMode)} options={AUTH_OPTIONS as any} />
                    </div>

                    {cfg.authMode === "url" ? (
                        <div className="grid grid-cols-1 gap-4">
                            <LabeledInput label="Connection URL" value={cfg.url || ""} onChange={(v) => upd("url", v)} placeholder="postgres://user:pass@host:5432/dbname" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <LabeledInput label="Host" value={cfg.host || ""} onChange={(v) => upd("host", v)} />
                            <LabeledNumber label="Port" value={cfg.port ?? ""} onChange={(v) => upd("port", (v === "" ? "" : Number(v)) as any)} />
                            <LabeledInput label="Database" value={cfg.dbName || ""} onChange={(v) => upd("dbName", v)} />
                            <LabeledInput label="Username" value={cfg.username || ""} onChange={(v) => upd("username", v)} />
                            <LabeledInput label="Password" type="password" value={cfg.password || ""} onChange={(v) => upd("password", v)} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <CheckToggle label="Use SSL" checked={!!cfg.ssl} onChange={(v) => upd("ssl", v)} />
                        <LabeledNumber label="Pool Min" value={cfg.poolMin ?? ""} onChange={(v) => upd("poolMin", (v === "" ? "" : Number(v)) as any)} />
                        <LabeledNumber label="Pool Max" value={cfg.poolMax ?? ""} onChange={(v) => upd("poolMax", (v === "" ? "" : Number(v)) as any)} />
                    </div>

                    <LabeledInput label="Read Replicas (CSV of URLs)" value={cfg.readReplicas || ""} onChange={(v) => upd("readReplicas", v)} placeholder="postgres://replica1..., postgres://replica2..." />

                    <Separator />

                    <div>
                        <div className="mb-2 text-sm font-medium">Table / Collection Mappings</div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {DOMAINS.map((d) => (
                                <LabeledInput key={d} label={d} value={cfg.mappings[d] || ""} onChange={(v) => updMapping(d, v)} />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={onTest} disabled={testing || loading}>{testing ? "Testing..." : "Test Connection"}</Button>
                        <Button variant="secondary" onClick={onDryRun} disabled={dryRunning || loading}>{dryRunning ? "Dry-running..." : "Dry-run migration"}</Button>
                        <div className="flex-1" />
                        <Button variant="success" onClick={onSave} disabled={saving || loading}>{saving ? "Saving..." : "Save"}</Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
