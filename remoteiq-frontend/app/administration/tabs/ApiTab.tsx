"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ToastFn, ApiKeyRow, ApiKeyScope } from "../types";
import { LabeledInput, LabeledNumber } from "../helpers";

interface ApiTabProps {
    push: ToastFn;
}

const ALL_SCOPES: ApiKeyScope[] = [
    "read:devices", "write:devices", "read:users", "write:users",
    "read:audit", "admin:roles", "admin:flags"
];

export default function ApiTab({ push }: ApiTabProps) {
    const [apiKeys, setApiKeys] = React.useState<ApiKeyRow[]>([
        {
            id: "k1",
            label: "CI deploy bot",
            prefix: "rk_live_2fA7",
            scopes: ["read:devices", "write:devices", "read:audit"],
            rateLimitRpm: 600,
            createdAt: "2025-10-10 09:12",
            lastUsedAt: "2025-10-17 13:44",
            type: "service",
            ipAllowlist: ["0.0.0.0/0"],
        },
    ]);
    const [newKeyLabel, setNewKeyLabel] = React.useState("");
    const [newKeyType, setNewKeyType] = React.useState<"personal" | "service">("service");
    const [newKeyScopes, setNewKeyScopes] = React.useState<ApiKeyScope[]>(["read:devices"]);
    const [newKeyRate, setNewKeyRate] = React.useState<number | "">("");
    const [newKeyIps, setNewKeyIps] = React.useState("");
    const [revealKeyId, setRevealKeyId] = React.useState<string | null>(null);
    const [webhookSecret, setWebhookSecret] = React.useState("whsec_xxxxxxxx");
    const [webhookEvents, setWebhookEvents] = React.useState<string[]>(["device.created", "alert.fired"]);
    const [allowedOrigins, setAllowedOrigins] = React.useState("https://portal.example.com");

    function toggleScope(scope: ApiKeyScope) {
        setNewKeyScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
    }

    function createApiKey() {
        if (!newKeyLabel.trim()) {
            return push({ title: "Key label required", kind: "warning" });
        }
        const id = Math.random().toString(36).slice(2);
        const prefix = "rk_live_" + Math.random().toString(36).slice(2, 6);
        setApiKeys((prev) => [
            {
                id,
                label: newKeyLabel.trim(),
                prefix,
                scopes: newKeyScopes,
                rateLimitRpm: newKeyRate === "" ? undefined : Number(newKeyRate),
                createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
                type: newKeyType,
                ipAllowlist: newKeyIps.split(",").map((s) => s.trim()).filter(Boolean),
            },
            ...prev,
        ]);
        setRevealKeyId(id);
        setNewKeyLabel("");
        setNewKeyType("service");
        setNewKeyScopes(["read:devices"]);
        setNewKeyRate("");
        setNewKeyIps("");
        push({ title: "API key created", kind: "success" });
    }

    function revokeKey(id: string) {
        setApiKeys((prev) => prev.filter((k) => k.id !== id));
        push({ title: "API key revoked", kind: "destructive" });
    }

    function rotateWebhookSecret() {
        const next = "whsec_" + Math.random().toString(36).slice(2, 10);
        setWebhookSecret(next);
        push({ title: "Webhook secret rotated", kind: "success" });
    }

    return (
        <TabsContent value="api" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>API & Webhooks</CardTitle>
                    <CardDescription>Keys, scopes, rate limits, webhooks, and allowed origins.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="rounded-md border p-3 space-y-3">
                        <div className="font-medium">Create API Key</div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <LabeledInput label="Label" value={newKeyLabel} onChange={setNewKeyLabel} />
                            <div className="grid gap-1">
                                <Label className="text-sm">Type</Label>
                                <Select value={newKeyType} onValueChange={(v: "service" | "personal") => setNewKeyType(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="service">Service account</SelectItem>
                                        <SelectItem value="personal">Personal access token</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <LabeledNumber label="Rate limit (rpm, optional)" value={newKeyRate} onChange={setNewKeyRate} />
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-sm">Scopes</Label>
                            <div className="flex flex-wrap gap-2 text-sm">
                                {ALL_SCOPES.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => toggleScope(s)}
                                        className={cn(
                                            "rounded border px-2 py-1",
                                            newKeyScopes.includes(s) ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-border"
                                        )}
                                        title={s}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <LabeledInput label="IP allowlist (comma-separated CIDRs, optional)" value={newKeyIps} onChange={setNewKeyIps} placeholder="192.168.1.0/24, 203.0.113.10/32" />

                        <div className="text-right">
                            <Button variant="success" onClick={createApiKey}>Create key</Button>
                        </div>

                        {revealKeyId && (
                            <div className="rounded-md border p-3 text-sm">
                                <div className="font-medium mb-1">New key (copy now)</div>
                                <div className="text-muted-foreground">
                                    {apiKeys.find((k) => k.id === revealKeyId)?.prefix}
                                    ••••••••••••••••••••••
                                </div>
                                <div className="text-xs mt-1">For security, this token will not be shown again.</div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-md border">
                        <div className="grid grid-cols-12 border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                            <div className="col-span-3 px-2">Label</div>
                            <div className="col-span-2 px-2">Prefix</div>
                            <div className="col-span-3 px-2">Scopes</div>
                            <div className="col-span-1 px-2">RPM</div>
                            <div className="col-span-2 px-2">Last used</div>
                            <div className="col-span-1 px-2 text-right">Actions</div>
                        </div>
                        {apiKeys.map((k) => (
                            <div key={k.id} className="grid grid-cols-12 items-center border-b p-2 last:border-b-0 text-sm">
                                <div className="col-span-3 px-2">
                                    {k.label} <span className="ml-2 text-xs rounded border px-1 py-0.5">{k.type}</span>
                                </div>
                                <div className="col-span-2 px-2 font-mono">{k.prefix}</div>
                                <div className="col-span-3 px-2 truncate">{k.scopes.join(", ")}</div>
                                <div className="col-span-1 px-2">{k.rateLimitRpm ?? "—"}</div>
                                <div className="col-span-2 px-2 text-muted-foreground">{k.lastUsedAt ?? "—"}</div>
                                <div className="col-span-1 px-2 text-right">
                                    <Button variant="destructive" size="sm" onClick={() => revokeKey(k.id)}>Revoke</Button>
                                </div>
                                {k.ipAllowlist?.length ? (
                                    <div className="col-span-12 px-2 pb-2 text-xs text-muted-foreground">IPs: {k.ipAllowlist.join(", ")}</div>
                                ) : null}
                            </div>
                        ))}
                    </div>

                    <div className="rounded-md border p-3 space-y-3">
                        <div className="font-medium">Webhooks</div>
                        <LabeledInput label="Signing secret" value={webhookSecret} onChange={setWebhookSecret} />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={rotateWebhookSecret}>Rotate secret</Button>
                            <Button variant="outline" onClick={() => push({ title: "Test event sent", kind: "success" })}>Send test event</Button>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm">Subscribed events</Label>
                            <div className="flex flex-wrap gap-2 text-sm">
                                {["device.created", "device.updated", "alert.fired", "invite.sent", "email.failed"].map((ev) => (
                                    <button
                                        key={ev}
                                        type="button"
                                        onClick={() => setWebhookEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]))}
                                        className={cn(
                                            "rounded border px-2 py-1",
                                            webhookEvents.includes(ev) ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-border"
                                        )}
                                    >
                                        {ev}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-md border p-3 space-y-2">
                        <div className="font-medium">CORS / Allowed Origins</div>
                        <LabeledInput label="Origins (comma-separated)" value={allowedOrigins} onChange={setAllowedOrigins} placeholder="https://app.example.com, https://admin.example.com" />
                    </div>

                    <div className="rounded-md border p-3 space-y-2">
                        <div className="font-medium">Quickstart</div>
                        <div className="text-xs text-muted-foreground">Example curl:</div>
                        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                            <code>{`curl -H "Authorization: Bearer rk_live_xxx" \\\n  https://api.remoteiq.local/v1/devices`}</code>
                        </pre>
                    </div>

                    <div className="text-right">
                        <Button variant="success" onClick={() => push({ title: "API configuration saved", kind: "success" })}>
                            Save API settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
