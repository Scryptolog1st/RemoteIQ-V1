"use client";

import * as React from "react";
import { useToast } from "@/lib/toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Terminal, Code2, Play, RefreshCcw, Globe, Copy } from "lucide-react";
import { AuditPanel } from "../components/AuditPanel";

type Props = { onDirtyChange: (dirty: boolean) => void; saveHandleRef: (h: { submit: () => void }) => void };

/**
 * Developer tab (nice-to-have features):
 * - Personal Access Tokens (separate from API keys) — local mock list.
 * - Webhook replay (mock) — shows last 5 deliveries with headers, replays to current URL.
 * - CLI snippets.
 */

type Pat = { id: string; label: string; createdAt: string; lastUsed?: string };

export default function DeveloperTab({ onDirtyChange, saveHandleRef }: Props) {
  const { push } = useToast();
  const [pats, setPats] = React.useState<Pat[]>([
    { id: "pat_live_ab12cd34", label: "CLI on MacBook", createdAt: new Date(Date.now() - 864e5).toISOString(), lastUsed: "2 hours ago" },
  ]);
  const [label, setLabel] = React.useState("");
  const [webhookUrl, setWebhookUrl] = React.useState("https://example.com/webhooks/remoteiq");
  const [deliveries, setDeliveries] = React.useState(
    Array.from({ length: 3 }).map((_, i) => ({
      id: `evt_${100 + i}`,
      status: 200,
      at: new Date(Date.now() - i * 3600_000).toISOString(),
      body: JSON.stringify({ event: "ticket.created", id: `${i}` }),
      headers: { "Content-Type": "application/json", "X-Example-Sig": "v1=abc123" },
    }))
  );

  React.useEffect(() => {
    onDirtyChange(false);
    saveHandleRef({ submit: () => void 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPat = () => {
    if (!label.trim()) {
      push({ title: "Label required", kind: "destructive" });
      return;
    }
    const id = `pat_live_${Math.random().toString(36).slice(2, 10)}`;
    setPats((prev) => [{ id, label, createdAt: new Date().toISOString() }, ...prev]);
    setLabel("");
    push({ title: "Personal access token created", kind: "success" });
  };

  const revokePat = (id: string) => {
    setPats((prev) => prev.filter((p) => p.id !== id));
    push({ title: "Token revoked", kind: "success" });
  };

  const replayDelivery = async (id: string) => {
    // mock success
    await new Promise((r) => setTimeout(r, 350));
    push({ title: `Replay sent (${id})`, kind: "success", desc: webhookUrl });
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* PATs */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Personal access tokens</CardTitle>
          <CardDescription>Use PATs for CLI or personal scripts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createPat();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., CLI on MacBook"
              aria-label="PAT label"
              className="max-w-sm"
            />
            <Button type="submit">Create token</Button>
          </form>

          <Separator />

          <div className="space-y-2">
            {pats.length === 0 && (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">No tokens yet.</div>
            )}
            {pats.map((p) => (
              <div key={p.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleString()} • Last used {p.lastUsed ?? "never"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{p.id.replace(/.(?=.{4})/g, "•")}</code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(p.id).then(() => push({ title: "Copied", kind: "success" }))}
                      aria-label="Copy token"
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => revokePat(p.id)}>
                      Revoke
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              <div className="font-medium">CLI</div>
            </div>
            <div className="mt-2 text-xs">
              <div className="rounded bg-muted p-2 font-mono">
                remoteiq login --token &lt;PAT&gt;
              </div>
              <div className="mt-1 text-muted-foreground">Use a PAT above for non-interactive usage.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook replay */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Webhook replay
          </CardTitle>
          <CardDescription>Resend recent deliveries to your endpoint.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              aria-label="Webhook URL"
              placeholder="https://example.com/webhooks/remoteiq"
            />
            <Button variant="outline" onClick={() => push({ title: "Endpoint updated", kind: "success" })}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Update
            </Button>
          </div>

          <div className="space-y-2">
            {deliveries.map((d) => (
              <div key={d.id} className="rounded-md border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{d.id}</div>
                  <div className="opacity-70">
                    {d.status} • {new Date(d.at).toLocaleString()}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="font-medium">Headers</div>
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(d.headers, null, 2)}</pre>
                </div>
                <div className="mt-2">
                  <div className="font-medium">Body</div>
                  <pre className="whitespace-pre-wrap break-words">{d.body}</pre>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => replayDelivery(d.id)}>
                    <Play className="mr-2 h-4 w-4" /> Replay
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              <div className="font-medium">SDK snippet</div>
            </div>
            <div className="mt-2 text-xs">
              <div className="rounded bg-muted p-2 font-mono">
                {`import RemoteIQ from "@remoteiq/sdk"
const client = new RemoteIQ({ apiKey: process.env.REMOTEIQ_API_KEY })`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AuditPanel section="developer" />
    </div>
  );
}
