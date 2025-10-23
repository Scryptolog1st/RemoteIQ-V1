"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IntegrationsSchema, type IntegrationsForm } from "@/lib/forms";
import { getIntegrations, updateIntegrations, testSlackWebhook, testGenericWebhook, rotateSigningSecret, previewSignature } from "@/lib/account-api";
import { useToast } from "@/lib/toast";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useAccountShortcuts } from "@/lib/shortcuts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlugZap, Link as LinkIcon, RefreshCcw } from "lucide-react";
import { AuditPanel } from "../components/AuditPanel";

type Props = { onDirtyChange: (dirty: boolean) => void; saveHandleRef: (h: { submit: () => void }) => void };
const DRAFT_KEY = "account.integrations.draft";

export default function IntegrationsTab({ onDirtyChange, saveHandleRef }: Props) {
  const { push } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sigPreview, setSigPreview] = React.useState<string>("");

  const form = useForm<IntegrationsForm>({
    resolver: zodResolver(IntegrationsSchema),
    defaultValues: { slackWebhook: "", webhookUrl: "", webhookSigningSecret: "", events: ["Tickets", "Alerts"] },
  });

  React.useEffect(() => {
    const draft = loadDraft<IntegrationsForm>(DRAFT_KEY);
    getIntegrations()
      .then((d) => form.reset(draft ?? d))
      .catch(() => setError("Failed to load integrations"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => onDirtyChange(form.formState.isDirty), [form.formState.isDirty, onDirtyChange]);
  React.useEffect(() => { const sub = form.watch((v) => saveDraft(DRAFT_KEY, v as IntegrationsForm)); return () => sub.unsubscribe(); }, [form]);

  const submitFn = React.useCallback(async (values: IntegrationsForm) => {
    try { await updateIntegrations(values); push({ title: "Integrations saved", kind: "success" }); form.reset(values); clearDraft(DRAFT_KEY); }
    catch { push({ title: "Error", kind: "destructive", desc: "Could not save integrations." }); }
  }, [form, push]);

  React.useEffect(() => { saveHandleRef({ submit: () => form.handleSubmit(submitFn)() }); }, [saveHandleRef, form, submitFn]);

  useAccountShortcuts({ onSave: () => form.handleSubmit(submitFn)(), onCancel: () => form.reset() });

  const autosave = useDebouncedCallback(async () => {
    const v = form.getValues();
    try { await updateIntegrations(v); push({ title: "Saved", kind: "success" }); form.reset(v); clearDraft(DRAFT_KEY); }
    catch { push({ title: "Auto-save failed", kind: "destructive" }); }
  }, 800);

  // Signature preview based on sample body
  const sampleBody = '{"event":"ticket.created","id":"123"}';
  React.useEffect(() => {
    const secret = form.watch("webhookSigningSecret");
    (async () => {
      if (!secret) { setSigPreview(""); return; }
      const p = await previewSignature(sampleBody, secret);
      setSigPreview(p.header);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("webhookSigningSecret")]);

  if (loading) return <Card><CardContent className="h-32 animate-pulse" /></Card>;
  if (error)
    return (
      <Card><CardContent className="p-4">
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">{error}</div>
        <Button variant="outline" onClick={() => location.reload()}>Retry</Button>
      </CardContent></Card>
    );

  const allEvents = ["Tickets", "Alerts", "Billing", "Integrations"];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlugZap className="h-5 w-5" />Slack</CardTitle>
          <CardDescription>Send alerts to a Slack channel via webhook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Incoming webhook URL</Label>
            <Input {...form.register("slackWebhook")} placeholder="https://hooks.slack.com/services/..." onBlur={autosave} />
            {form.formState.errors.slackWebhook && <p className="mt-1 text-xs text-red-600">{form.formState.errors.slackWebhook.message}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={async () => {
              const r = await testSlackWebhook(form.getValues("slackWebhook"));
              push({ kind: r.ok ? "success" : "destructive", title: r.ok ? "Webhook OK" : "Webhook failed", desc: `${r.status} • ${r.ms}ms` });
            }}>Test Slack</Button>
            <Button onClick={() => form.handleSubmit(submitFn)()} disabled={!form.formState.isDirty}>Save Slack</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5" />Webhook</CardTitle>
          <CardDescription>Receive POST callbacks for events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Callback URL</Label>
            <Input {...form.register("webhookUrl")} placeholder="https://example.com/webhooks/remoteiq" onBlur={autosave} />
            {form.formState.errors.webhookUrl && <p className="mt-1 text-xs text-red-600">{form.formState.errors.webhookUrl.message}</p>}
          </div>
          <div>
            <Label>Signing secret</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={form.watch("webhookSigningSecret") || "—"} />
              <Button type="button" variant="outline" onClick={async () => {
                const r = await rotateSigningSecret();
                form.setValue("webhookSigningSecret", r.secret, { shouldDirty: true });
                autosave();
              }}>
                Rotate <RefreshCcw className="ml-1 h-4 w-4" />
              </Button>
            </div>
            {sigPreview && <code className="mt-2 block text-xs break-all">{sigPreview}</code>}
          </div>
          <div>
            <Label>Event subscriptions</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {allEvents.map((p) => (
                <label key={p} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.watch("events").includes(p)}
                    onChange={(e) => {
                      const arr = new Set(form.getValues("events"));
                      e.target.checked ? arr.add(p) : arr.delete(p);
                      form.setValue("events", Array.from(arr), { shouldDirty: true });
                      autosave();
                    }}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={async () => {
              const r = await testGenericWebhook(form.getValues("webhookUrl"));
              push({ kind: r.ok ? "success" : "destructive", title: r.ok ? "Webhook OK" : "Webhook failed", desc: `${r.status} • ${r.ms}ms` });
            }}>Test webhook</Button>
            <Button onClick={() => form.handleSubmit(submitFn)()} disabled={!form.formState.isDirty}>Save webhook</Button>
          </div>
        </CardContent>
      </Card>

      <AuditPanel section="integrations" />
    </div>
  );
}
