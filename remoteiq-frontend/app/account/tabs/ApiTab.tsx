"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiKeyCreateSchema, type ApiKeyCreateForm } from "@/lib/forms";
import { listApiKeys, createApiKey, revokeApiKey, type ApiKey, regenerateApiKey, keyUsage } from "@/lib/account-api";
import { useToast } from "@/lib/toast";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft";
import { useAccountShortcuts } from "@/lib/shortcuts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, KeyRound, Lock, Trash2, RefreshCcw } from "lucide-react";

type Props = { onDirtyChange: (dirty: boolean) => void; saveHandleRef: (h: { submit: () => void }) => void };
const DRAFT_KEY = "account.api.draft";

export default function ApiTab({ onDirtyChange, saveHandleRef }: Props) {
  const { push } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [keys, setKeys] = React.useState<ApiKey[]>([]);
  const [show, setShow] = React.useState(false);
  const [usage, setUsage] = React.useState<Record<string, { d: number; c: number }[]>>({});

  const form = useForm<ApiKeyCreateForm>({
    resolver: zodResolver(ApiKeyCreateSchema),
    defaultValues: { label: "", scopes: ["read"], expiresIn: "never", ipAllowlist: "" },
  });
  React.useEffect(() => onDirtyChange(form.formState.isDirty), [form.formState.isDirty, onDirtyChange]);

  const load = React.useCallback(() => {
    setLoading(true); setError(null);
    listApiKeys()
      .then(async (ks) => {
        setKeys(ks);
        const all = await Promise.all(ks.map((k) => keyUsage(k.id)));
        const map: typeof usage = {};
        all.forEach((u) => (map[u.id] = u.last7));
        setUsage(map);
      })
      .catch(() => setError("Failed to load API keys"))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { const draft = loadDraft<ApiKeyCreateForm>(DRAFT_KEY); if (draft) form.reset(draft); load(); }, [load]); // eslint-disable-line

  React.useEffect(() => { const sub = form.watch((v) => saveDraft(DRAFT_KEY, v as ApiKeyCreateForm)); return () => sub.unsubscribe(); }, [form]);

  const submitFn = React.useCallback(async (values: ApiKeyCreateForm) => {
    const ips = values.ipAllowlist?.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean) || [];
    const k = await createApiKey(values.label, values.scopes, values.expiresIn, ips.join(","));
    setKeys((prev) => [k, ...prev]);
    push({ title: "API key created", kind: "success", desc: "Copy and store it securely." });
    form.reset({ label: "", scopes: ["read"], expiresIn: "never", ipAllowlist: "" });
    clearDraft(DRAFT_KEY);
  }, [form, push]);

  React.useEffect(() => { saveHandleRef({ submit: () => form.handleSubmit(submitFn)() }); }, [saveHandleRef, form, submitFn]);

  useAccountShortcuts({ onSave: () => form.handleSubmit(submitFn)(), onCancel: () => form.reset() });

  if (loading) return <Card><CardContent className="h-32 animate-pulse" /></Card>;
  if (error)
    return (
      <Card><CardContent className="p-4">
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">{error}</div>
        <Button variant="outline" onClick={load}>Retry</Button>
      </CardContent></Card>
    );

  const scopePresets: Record<string, string[]> = {
    "Read-only reporting": ["read"],
    "Automation Bot": ["read", "write"],
    "Billing Ops": ["read", "billing"],
    "Admin": ["read", "write", "billing", "admin"],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>Manage programmatic access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <div>
              <div className="font-medium">Publishable key</div>
              <div className="text-xs text-muted-foreground">Use on the client where needed.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs">pk_live_abc123…</code>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText("pk_live_abc123").then(() => push({ title: "Copied", kind: "success" }))}>Copy</Button>
          </div>
        </div>

        <Separator />

        <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(submitFn)(); }} className="grid gap-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label htmlFor="label" className="text-sm font-medium">Label</label>
              <Input id="label" placeholder="e.g., Production server" {...form.register("label")} />
              {form.formState.errors.label && <p className="mt-1 text-xs text-red-600">{form.formState.errors.label.message}</p>}
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium">Scopes</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {(["read", "write", "billing", "admin"] as const).map((s) => (
                  <label key={s} className="text-xs flex items-center gap-1 rounded border px-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.watch("scopes").includes(s)}
                      onChange={(e) => {
                        const set = new Set(form.getValues("scopes"));
                        e.target.checked ? set.add(s) : set.delete(s);
                        form.setValue("scopes", Array.from(set) as any, { shouldDirty: true });
                      }}
                    /> {s}
                  </label>
                ))}
              </div>
              {form.formState.errors.scopes && <p className="mt-1 text-xs text-red-600">{(form.formState.errors.scopes as any).message}</p>}
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium">Expiration</label>
              <select className="w-full rounded border px-2 py-2 text-sm mt-1" value={form.watch("expiresIn")} onChange={(e) => form.setValue("expiresIn", e.target.value as any, { shouldDirty: true })}>
                <option value="never">Never</option><option value="30d">30 days</option><option value="90d">90 days</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm font-medium">IP allowlist (one per line or comma separated)</label>
              <textarea className="mt-1 w-full rounded border p-2 text-sm" rows={3} value={form.watch("ipAllowlist")} onChange={(e) => form.setValue("ipAllowlist", e.target.value, { shouldDirty: true })} />
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium">Presets</label>
              <div className="mt-1 grid gap-2">
                {Object.entries(scopePresets).map(([name, scopes]) => (
                  <Button key={name} type="button" variant="outline" size="sm" onClick={() => form.setValue("scopes", scopes as any, { shouldDirty: true })}>{name}</Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit"><KeyRound className="mr-2 h-4 w-4" />Create key</Button>
          </div>
        </form>

        <div className="space-y-2">
          {keys.length === 0 && <div className="rounded-md border p-3 text-sm text-muted-foreground">No keys yet. Create one to begin.</div>}
          {keys.map((k) => (
            <div key={k.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{k.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Scopes: {(k.scopes || []).join(", ") || "—"} {k.expiresAt ? `• Expires ${new Date(k.expiresAt).toLocaleDateString()}` : ""} • Last used {k.lastUsed ?? "never"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs">{show ? k.id : k.id.replace(/.(?=.{4})/g, "•")}</code>
                  <Button variant="outline" size="sm" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide keys" : "Show keys"}>
                    {show ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}{show ? "Hide" : "Show"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={async () => { const r = await regenerateApiKey(k.id); await navigator.clipboard.writeText(r.newKey); push({ title: "Regenerated", kind: "success", desc: "New key copied to clipboard." }); }}>
                    <RefreshCcw className="mr-2 h-4 w-4" />Regenerate
                  </Button>
                  <Button variant="outline" size="sm" onClick={async () => { await revokeApiKey(k.id); setKeys((prev) => prev.filter((x) => x.id !== k.id)); }}>
                    <Trash2 className="mr-2 h-4 w-4" />Revoke
                  </Button>
                </div>
              </div>
              {usage[k.id] && (
                <div className="mt-2 text-xs text-muted-foreground">
                  7-day usage: {usage[k.id].map((d) => d.c).join(" • ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
