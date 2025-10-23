"use client";

import * as React from "react";
import { useForm, type SubmitHandler, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useToast } from "@/lib/toast";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useAccountShortcuts } from "@/lib/shortcuts";

import {
  getIntegrations,          // () => Promise<IntegrationsForm>
  updateIntegrations,       // (v: IntegrationsForm) => Promise<void>
} from "@/lib/account-api";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { AuditPanel } from "../components/AuditPanel";

type Props = {
  onDirtyChange: (dirty: boolean) => void;
  saveHandleRef: (h: { submit: () => void }) => void;
};

const DRAFT_KEY = "account.integrations.draft";

/** Security-first sub-schemas (defaults everywhere; strict objects) */
const WebhookSchema = z
  .object({
    enabled: z.boolean().default(false),
    url: z.string().url("Must be a valid URL").max(500, "URL too long").default(""),
    /** Masked preview only; never the raw secret. */
    secretPreview: z.string().default(""),
  })
  .strict();

const SlackSchema = z
  .object({
    enabled: z.boolean().default(false),
    mode: z.enum(["incoming-webhook", "app"]).default("incoming-webhook"),
    /** Write-only; UI never re-renders the stored value */
    incomingWebhookUrl: z.string().default(""),
  })
  .strict();

const TeamsSchema = z
  .object({
    enabled: z.boolean().default(false),
    connectorWebhookUrl: z.string().default(""),
  })
  .strict();

const PagerDutySchema = z
  .object({
    enabled: z.boolean().default(false),
    routingKey: z.string().default(""),
  })
  .strict();

const IntegrationsSchema = z
  .object({
    digest: z.enum(["never", "daily", "weekly"]).default("daily"),
    events: z.array(z.string()).default([]),
    webhooks: WebhookSchema.default({ enabled: false, url: "", secretPreview: "" }),
    slack: SlackSchema.default({ enabled: false, mode: "incoming-webhook", incomingWebhookUrl: "" }),
    teams: TeamsSchema.default({ enabled: false, connectorWebhookUrl: "" }),
    pagerduty: PagerDutySchema.default({ enabled: false, routingKey: "" }),
  })
  .strict();

/** Important: with defaults, Input is "partial-ish", Output is fully required. */
type IntegrationsInput = z.input<typeof IntegrationsSchema>;
type IntegrationsOutput = z.output<typeof IntegrationsSchema>;
export type IntegrationsForm = IntegrationsOutput;

const DEFAULTS: IntegrationsForm = {
  digest: "daily",
  events: ["rmm.alerts", "tickets.updated"],
  webhooks: { enabled: false, url: "", secretPreview: "" },
  slack: { enabled: false, mode: "incoming-webhook", incomingWebhookUrl: "" },
  teams: { enabled: false, connectorWebhookUrl: "" },
  pagerduty: { enabled: false, routingKey: "" },
};

export default function IntegrationsTab({ onDirtyChange, saveHandleRef }: Props) {
  const { push } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  /** Cast the resolver so its FieldValues match the form’s Output type. */
  const resolver = zodResolver(IntegrationsSchema) as unknown as Resolver<IntegrationsForm>;

  const form = useForm<IntegrationsForm>({
    resolver,
    defaultValues: DEFAULTS,
    mode: "onChange",
  });

  // Initial load with draft recovery
  React.useEffect(() => {
    const draft = loadDraft<IntegrationsForm>(DRAFT_KEY);
    getIntegrations()
      .then((serverState) => {
        form.reset(draft ?? serverState ?? DEFAULTS, { keepDefaultValues: false });
      })
      .catch(() => setError("Failed to load integrations"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dirty tracking + draft persistence
  React.useEffect(() => onDirtyChange(form.formState.isDirty), [form.formState.isDirty, onDirtyChange]);
  React.useEffect(() => {
    const sub = form.watch((v) => saveDraft(DRAFT_KEY, (v as unknown) as IntegrationsForm));
    return () => sub.unsubscribe();
  }, [form]);

  // Typed, memoized submit handler (fixes 2345 + ESLint exhaustive-deps)
  const onSubmit = React.useCallback<SubmitHandler<IntegrationsForm>>(
    async (values) => {
      try {
        await updateIntegrations(values);
        push({ title: "Integration settings saved", kind: "success" });
        form.reset(values);
        clearDraft(DRAFT_KEY);
      } catch {
        push({
          title: "Error",
          kind: "destructive",
          desc: "Could not save integration settings.",
        });
      }
    },
    [form, push]
  );

  // Expose Save to parent toolbar
  React.useEffect(() => {
    saveHandleRef({ submit: () => form.handleSubmit(onSubmit)() });
  }, [saveHandleRef, form, onSubmit]);

  // Keyboard shortcuts (Ctrl/Cmd+S to save, Esc to reset)
  useAccountShortcuts({
    onSave: () => form.handleSubmit(onSubmit)(),
    onCancel: () => form.reset(),
  });

  // Autosave for low-risk fields
  const autosave = useDebouncedCallback(async () => {
    const v = form.getValues();
    try {
      await updateIntegrations(v);
      push({ title: "Saved", kind: "success" });
      form.reset(v);
      clearDraft(DRAFT_KEY);
    } catch {
      push({ title: "Auto-save failed", kind: "destructive" });
    }
  }, 800);

  if (loading) {
    return (
      <Card>
        <CardContent className="h-32 animate-pulse" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">
            {error}
          </div>
          <Button variant="outline" onClick={() => location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const eventOptions = [
    { id: "rmm.alerts", label: "RMM Alerts" },
    { id: "tickets.updated", label: "Ticket Updates" },
    { id: "billing.events", label: "Billing Events" },
    { id: "integrations.status", label: "Integration Status" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect third-party services and webhooks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Digest */}
          <div className="max-w-sm">
            <Label>Notification digest to integrations</Label>
            <Select
              value={form.watch("digest")}
              onValueChange={(v) => {
                form.setValue("digest", v as IntegrationsForm["digest"], { shouldDirty: true });
                autosave();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Events */}
          <div>
            <Label>Events to send</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {eventOptions.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.watch("events").includes(e.id)}
                    onChange={(ev) => {
                      const set = new Set(form.getValues("events"));
                      ev.target.checked ? set.add(e.id) : set.delete(e.id);
                      form.setValue("events", Array.from(set), { shouldDirty: true });
                      autosave();
                    }}
                  />
                  <span>{e.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Webhooks */}
          <SectionHeader
            title="Outgoing Webhook"
            right={
              form.watch("webhooks.enabled") ? (
                <Badge variant="secondary">Enabled</Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )
            }
          />
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("webhooks.enabled")}
                  onCheckedChange={(v) => {
                    form.setValue("webhooks.enabled", v, { shouldDirty: true });
                    autosave();
                  }}
                  aria-label="Enable webhook"
                />
                <span className="text-sm">Enable</span>
              </div>
              <div className="text-xs opacity-70">Signed with secret (never shown)</div>
            </div>
            <div className="grid gap-2 max-w-xl">
              <Label htmlFor="webhook-url">Destination URL</Label>
              <Input
                id="webhook-url"
                inputMode="url"
                placeholder="https://example.com/webhooks/remoteiq"
                value={form.watch("webhooks.url")}
                onChange={(e) => {
                  form.setValue("webhooks.url", e.target.value, { shouldDirty: true });
                }}
                onBlur={autosave}
              />
              {form.watch("webhooks.secretPreview") && (
                <div className="text-xs text-muted-foreground">
                  Current signing key: {form.watch("webhooks.secretPreview")}
                </div>
              )}
            </div>
          </div>

          {/* Slack */}
          <SectionHeader title="Slack" />
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("slack.enabled")}
                  onCheckedChange={(v) => {
                    form.setValue("slack.enabled", v, { shouldDirty: true });
                    autosave();
                  }}
                  aria-label="Enable Slack"
                />
                <span className="text-sm">Enable</span>
              </div>
              <div className="max-w-xs">
                <Label className="text-xs">Mode</Label>
                <Select
                  value={form.watch("slack.mode")}
                  onValueChange={(v) => {
                    form.setValue("slack.mode", v as "incoming-webhook" | "app", { shouldDirty: true });
                    autosave();
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incoming-webhook">Incoming Webhook</SelectItem>
                    <SelectItem value="app">Slack App</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.watch("slack.mode") === "incoming-webhook" && (
              <div className="grid gap-2 max-w-xl">
                <Label htmlFor="slack-hook">Incoming Webhook URL (write-only)</Label>
                <Input
                  id="slack-hook"
                  inputMode="url"
                  placeholder="https://hooks.slack.com/services/…"
                  value={form.getValues("slack.incomingWebhookUrl")}
                  onChange={(e) =>
                    form.setValue("slack.incomingWebhookUrl", e.target.value, { shouldDirty: true })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  We only send this once; it won’t be displayed again.
                </p>
              </div>
            )}
          </div>

          {/* Microsoft Teams */}
          <SectionHeader title="Microsoft Teams" />
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("teams.enabled")}
                  onCheckedChange={(v) => {
                    form.setValue("teams.enabled", v, { shouldDirty: true });
                    autosave();
                  }}
                  aria-label="Enable Microsoft Teams"
                />
                <span className="text-sm">Enable</span>
              </div>
            </div>
            <div className="grid gap-2 max-w-xl">
              <Label htmlFor="teams-hook">Connector Webhook URL (write-only)</Label>
              <Input
                id="teams-hook"
                inputMode="url"
                placeholder="https://<tenant>.webhook.office.com/webhookb2/…"
                value={form.getValues("teams.connectorWebhookUrl")}
                onChange={(e) =>
                  form.setValue("teams.connectorWebhookUrl", e.target.value, { shouldDirty: true })
                }
              />
              <p className="text-xs text-muted-foreground">
                Stored securely; value won’t be shown once saved.
              </p>
            </div>
          </div>

          {/* PagerDuty */}
          <SectionHeader title="PagerDuty" />
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("pagerduty.enabled")}
                  onCheckedChange={(v) => {
                    form.setValue("pagerduty.enabled", v, { shouldDirty: true });
                    autosave();
                  }}
                  aria-label="Enable PagerDuty"
                />
                <span className="text-sm">Enable</span>
              </div>
            </div>
            <div className="grid gap-2 max-w-xl">
              <Label htmlFor="pd-key">Routing Key (write-only)</Label>
              <Input
                id="pd-key"
                type="password"
                placeholder="••••••••••••"
                value={form.getValues("pagerduty.routingKey")}
                onChange={(e) =>
                  form.setValue("pagerduty.routingKey", e.target.value, { shouldDirty: true })
                }
              />
              <p className="text-xs text-muted-foreground">
                We’ll use this key for Events API v2. It won’t be displayed later.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              Send example to integrations
            </Button>
            <Button onClick={() => form.handleSubmit(onSubmit)()} disabled={!form.formState.isDirty}>
              Save integration settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right rail */}
      <AuditPanel section="integrations" />

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Example payload</DialogTitle>
          </DialogHeader>
          <div className="rounded border p-3 text-sm">
            <div className="font-mono text-xs break-all">
              {JSON.stringify(
                {
                  type: "test.event",
                  sentAt: new Date().toISOString(),
                  digest: form.watch("digest"),
                  events: form.watch("events"),
                },
                null,
                2
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Small section header with optional right-aligned content */
function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="font-medium">{title}</div>
      {right}
    </div>
  );
}
