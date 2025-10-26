"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotificationsSchema, type NotificationsForm } from "@/lib/forms";
import { getNotifications, updateNotifications, sendTestEmail } from "@/lib/account-api";
import { useToast } from "@/lib/toast";
import { saveDraft, loadDraft, clearDraft } from "@/lib/draft";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useAccountShortcuts } from "@/lib/shortcuts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuditPanel } from "../components/AuditPanel";

type Props = {
  onDirtyChange: (dirty: boolean) => void;
  saveHandleRef: (h: { submit: () => void }) => void;
};

const DRAFT_KEY = "account.notifications.draft";

export default function NotificationsTab({ onDirtyChange, saveHandleRef }: Props) {
  const { push } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [status, setStatus] = React.useState<{ message: string; tone: "default" | "error" }>({
    message: "All changes saved.",
    tone: "default",
  });

  const form = useForm<NotificationsForm>({
    resolver: zodResolver(NotificationsSchema),
    defaultValues: {
      email: true,
      push: false,
      product: true,
      digest: "daily",
      quiet: { enabled: false, start: "22:00", end: "07:00" },
      // Removed "Billing"
      products: ["RMM Alerts"],
    },
    mode: "onChange",
  });

  // watches for cleaner JSX and less re-computation
  const emailEnabled = form.watch("email");
  const pushEnabled = form.watch("push");
  const productUpdatesEnabled = form.watch("product");
  const digestFrequency = form.watch("digest");
  const quietHoursEnabled = form.watch("quiet.enabled");
  const quietHoursStart = form.watch("quiet.start");
  const quietHoursEnd = form.watch("quiet.end");
  const selectedProducts = form.watch("products");
  const quietEndError = form.formState.errors.quiet?.end;

  React.useEffect(() => {
    const draft = loadDraft<NotificationsForm>(DRAFT_KEY);
    getNotifications()
      .then((d) => form.reset(draft ?? d))
      .catch(() => setError("Failed to load notifications"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => onDirtyChange(form.formState.isDirty), [form.formState.isDirty, onDirtyChange]);

  React.useEffect(() => {
    const sub = form.watch((v) => saveDraft(DRAFT_KEY, v as NotificationsForm));
    return () => sub.unsubscribe();
  }, [form]);

  const submitFn = React.useCallback(
    async (values: NotificationsForm) => {
      try {
        await updateNotifications(values);
        push({ title: "Notification prefs saved", kind: "success" });
        setStatus({ message: "Notifications saved.", tone: "default" });
        form.reset(values);
        clearDraft(DRAFT_KEY);
      } catch {
        push({ title: "Error", kind: "destructive", desc: "Could not save notifications." });
        setStatus({ message: "Save failed. Try again.", tone: "error" });
      }
    },
    [form, push]
  );

  React.useEffect(() => {
    saveHandleRef({ submit: () => form.handleSubmit(submitFn)() });
  }, [saveHandleRef, form, submitFn]);

  useAccountShortcuts({
    onSave: () => form.handleSubmit(submitFn)(),
    onCancel: () => form.reset(),
  });

  // Debounced autosave for low-risk changes (toggles, digest, quiet times, products)
  const autosave = useDebouncedCallback(async () => {
    setStatus({ message: "Saving…", tone: "default" });

    const valid = await form.trigger(undefined, { shouldFocus: false });
    if (!valid) {
      setStatus({ message: "Resolve the errors above to finish saving.", tone: "error" });
      return;
    }

    const v = form.getValues();
    try {
      await updateNotifications(v);
      form.reset(v);
      clearDraft(DRAFT_KEY);
      setStatus({ message: "Saved automatically.", tone: "default" });
    } catch {
      push({ title: "Auto-save failed", kind: "destructive" });
      setStatus({ message: "Auto-save failed. Use Save notifications.", tone: "error" });
    }
  }, 800);

  const queueAutosave = React.useCallback(() => {
    setStatus({ message: "Pending auto-save…", tone: "default" });
    autosave();
  }, [autosave]);

  // reset status strip back to "All changes saved." after a short delay, if clean
  React.useEffect(() => {
    if (status.tone === "error") return;
    if (!status.message || status.message === "All changes saved.") return;
    if (form.formState.isDirty) return;

    const timeout = window.setTimeout(() => {
      if (!form.formState.isDirty) {
        setStatus({ message: "All changes saved.", tone: "default" });
      }
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [form.formState.isDirty, status]);

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

  // Product/event subscription options (removed "Billing")
  const products = ["RMM Alerts", "Tickets", "Integrations"];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose how you’re notified about events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Accessible live region for status updates + visible strip */}
          <div aria-live="polite" className="sr-only">
            {status.message}
          </div>
          <p aria-hidden="true" className={`text-xs ${status.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
            {status.message}
          </p>

          {/* Primary toggles */}
          <ToggleRow
            label="Email alerts"
            checked={emailEnabled}
            onChange={(v) => {
              form.setValue("email", v, { shouldDirty: true });
              queueAutosave();
            }}
          />
          <ToggleRow
            label="Push notifications"
            checked={pushEnabled}
            onChange={(v) => {
              form.setValue("push", v, { shouldDirty: true });
              queueAutosave();
            }}
          />
          <ToggleRow
            label="Product updates"
            checked={productUpdatesEnabled}
            onChange={(v) => {
              form.setValue("product", v, { shouldDirty: true });
              queueAutosave();
            }}
          />

          {/* Digest frequency */}
          <div className="max-w-sm">
            <Label>Digest frequency</Label>
            <Select
              value={digestFrequency}
              onValueChange={(v) => {
                form.setValue("digest", v as any, { shouldDirty: true });
                queueAutosave();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quiet hours — below Digest frequency */}
          <div className="max-w-sm">
            <Label className="block">Quiet hours</Label>
            <div className="flex items-center justify-between rounded-md border p-3 gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={quietHoursEnabled}
                  onCheckedChange={(v) => {
                    form.setValue("quiet.enabled", v, { shouldDirty: true });
                    queueAutosave();
                  }}
                  aria-label="Enable quiet hours"
                />
                <span className="text-sm">Enable</span>
              </div>
              <div className="flex items-center gap-2">
                <InputTime
                  value={quietHoursStart}
                  onValueChange={(v) => {
                    form.setValue("quiet.start", v, { shouldDirty: true });
                    queueAutosave();
                  }}
                  aria-label="Quiet hours start"
                />
                <span className="text-xs opacity-60">to</span>
                <InputTime
                  value={quietHoursEnd}
                  onValueChange={(v) => {
                    form.setValue("quiet.end", v, { shouldDirty: true });
                    queueAutosave();
                  }}
                  aria-label="Quiet hours end"
                  aria-invalid={!!quietEndError}
                />
              </div>
            </div>
            {quietEndError && <p className="mt-2 text-xs text-destructive">{quietEndError.message}</p>}
          </div>

          {/* Event subscriptions */}
          <div>
            <Label>Event subscriptions</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {products.map((p) => (
                <label key={p} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedProducts.includes(p)}
                    onChange={(e) => {
                      const arr = new Set(form.getValues("products"));
                      e.target.checked ? arr.add(p) : arr.delete(p);
                      form.setValue("products", Array.from(arr), { shouldDirty: true });
                      queueAutosave();
                    }}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
              Preview email
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const r = await sendTestEmail();
                push({ title: "Test email sent", kind: "success", desc: r.id });
              }}
            >
              Send test
            </Button>
            <Button onClick={() => form.handleSubmit(submitFn)()} disabled={!form.formState.isDirty}>
              Save notifications
            </Button>
          </div>
        </CardContent>
      </Card>

      <AuditPanel section="notifications" />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Example email</DialogTitle>
          </DialogHeader>
          <div className="rounded border p-3 text-sm">
            <div><strong>Subject:</strong> RemoteIQ — Example alert</div>
            <div className="mt-2">Hello! This is how your alerts will look. Digest: {form.watch("digest")}.</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  helper,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  helper?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <div className="font-medium">{label}</div>
        {helper && <div className="text-xs text-muted-foreground">{helper}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function InputTime({
  value,
  onValueChange,
  ...rest
}: {
  value: string;
  onValueChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const invalid = rest["aria-invalid"] === true || rest["aria-invalid"] === "true";
  const base = "rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
  const cls = invalid ? `${base} border-destructive focus-visible:ring-destructive` : `${base} border-input`;
  return <input type="time" value={value} onChange={(e) => onValueChange(e.target.value)} {...rest} className={cls} />;
}
