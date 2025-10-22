// app/account/tabs/SessionsTab.tsx
"use client";

import * as React from "react";
import {
  listMySessions,
  revokeMySession,
  revokeAllOtherSessions,
  trustMySession,
  type Session as MeSession,
  type SessionDTO,
} from "@/lib/api";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShieldAlert, ShieldCheck, Globe, Smartphone, Monitor, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast";

type Props = {
  onDirtyChange: (dirty: boolean) => void;
  saveHandleRef: (h: { submit: () => void }) => void;
};

// Map API session -> strict UI DTO (no undefineds for required fields)
function toDTO(s: MeSession): SessionDTO {
  return {
    id: String(s.id),
    device: (s as any).label ?? s.userAgent ?? "Unknown device",
    ip: (s as any).ip ?? "",
    lastActive: (s as any).lastSeenAt ?? "",
    current: Boolean((s as any).current),
    city: (s as any).city ?? "",
    isp: (s as any).isp ?? "",
    trusted: Boolean((s as any).trusted),
  } as SessionDTO;
}

function relTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export default function SessionsTab({ onDirtyChange, saveHandleRef }: Props) {
  const { push } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<SessionDTO[]>([]);

  const [busyAll, setBusyAll] = React.useState(false);
  const [busyOne, setBusyOne] = React.useState<string | null>(null);
  const [busyTrust, setBusyTrust] = React.useState<string | null>(null);

  React.useEffect(() => {
    onDirtyChange(false);
    saveHandleRef({ submit: () => void 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Define loader BEFORE any effects that reference it
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMySessions(); // GET /api/users/me/sessions/
      setSessions((res.items ?? []).map(toDTO));
    } catch (e: any) {
      if ((e?.message || "").toLowerCase().includes("unauthorized")) {
        push({ title: "Session expired — please sign in again.", kind: "destructive" });
        window.location.href = "/login";
        return;
      }
      setError(e?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [push]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  React.useEffect(() => {
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const revokeOne = async (id: string) => {
    const target = sessions.find((s) => s.id === id);
    if (target?.current) {
      // Hard guard: never allow revoking the current session
      push({ title: "You can’t revoke your current session.", kind: "destructive" });
      return;
    }

    setBusyOne(id);
    const prev = sessions;
    setSessions(prev.filter((s) => s.id !== id));
    try {
      await revokeMySession(id); // DELETE/POST fallback handled in lib/api.ts
      push({ title: "Session revoked", kind: "success" });
    } catch (e: any) {
      setSessions(prev);
      push({ title: e?.message || "Failed to revoke session", kind: "destructive" });
    } finally {
      setBusyOne(null);
    }
  };

  const revokeOthers = async () => {
    if (!confirm("Revoke all other sessions? This will sign you out everywhere else.")) return;
    setBusyAll(true);
    const prev = sessions;
    // Optimistic UI: keep only the current one
    setSessions(prev.filter((s) => s.current));
    try {
      await revokeAllOtherSessions(); // POST /api/users/me/sessions/revoke-all
      push({ title: "All other sessions revoked", kind: "success" });
      void load();
    } catch (e: any) {
      setSessions(prev);
      push({ title: e?.message || "Failed to revoke other sessions", kind: "destructive" });
    } finally {
      setBusyAll(false);
    }
  };

  const toggleTrust = async (s: SessionDTO) => {
    setBusyTrust(s.id);
    const prev = sessions;
    const nextTrusted = !s.trusted;
    setSessions(prev.map((x) => (x.id === s.id ? { ...x, trusted: nextTrusted } : x)));
    try {
      await trustMySession(s.id, nextTrusted); // POST /api/users/me/sessions/:id/trust
      push({
        title: nextTrusted ? "Device marked as trusted" : "Device untrusted",
        kind: "success",
      });
    } catch (e: any) {
      setSessions(prev);
      push({ title: e?.message || "Failed to update trust", kind: "destructive" });
    } finally {
      setBusyTrust(null);
    }
  };

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
          <div role="alert" className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            {error}
          </div>
          <Button variant="outline" onClick={load}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active sessions</CardTitle>
            <CardDescription>Review and manage signed-in devices.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} title="Refresh sessions">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {sessions.map((s) => {
            const isMobile = /iphone|android|ios/i.test(s.device || "");
            const icon = isMobile ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
            const risk = s.city ? "low" : "med";

            return (
              <div key={s.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {icon}
                      <div className="font-medium truncate">
                        {s.device || "Unknown device"}
                        {s.current ? " • This device" : ""}
                      </div>
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      <span>{s.ip || "—"}</span>
                      {s.city && <span>• {s.city}</span>}
                      {s.isp && <span>• {s.isp}</span>}
                      {s.lastActive && <span>• Last active {relTime(s.lastActive)}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={s.trusted ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleTrust(s)}
                      disabled={busyTrust === s.id}
                      aria-label={s.trusted ? "Untrust device" : "Trust device"}
                      title={s.trusted ? "Mark this device as untrusted" : "Mark this device as trusted"}
                    >
                      {busyTrust === s.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : s.trusted ? (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      ) : (
                        <ShieldAlert className="mr-2 h-4 w-4" />
                      )}
                      {s.trusted ? "Trusted" : "Trust"}
                    </Button>

                    {/* Never allow revoking the current session */}
                    {!s.current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeOne(s.id)}
                        disabled={busyOne === s.id}
                        aria-label="Revoke session"
                        title="Revoke this session"
                      >
                        {busyOne === s.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="mr-2 h-4 w-4" />
                        )}
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  Risk: {risk === "low" ? "Low" : "Medium"} — {s.trusted ? "Trusted device" : "New device or location"}
                </div>
              </div>
            );
          })}

          {sessions.length === 0 && (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">No active sessions.</div>
          )}

          <Separator />

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={revokeOthers}
              disabled={busyAll || sessions.every((s) => s.current)}
              aria-label="Revoke all other sessions"
              title="Revoke all sessions except this device"
            >
              {busyAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              Revoke all other sessions
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Optional third column if you add an audit panel later */}
    </div>
  );
}
