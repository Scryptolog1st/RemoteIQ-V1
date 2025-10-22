// app/account/tabs/ProfileTab.tsx
"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/toast";
import type { MeProfile } from "@/lib/api";
import { getMyProfile, updateMyProfile } from "@/lib/api";

/* ---------------------- helpers: TZ & locale lists ---------------------- */

const TZ_FALLBACK = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Warsaw",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Jakarta",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function getAllTimeZones(): string[] {
  try {
    const fn = (Intl as any)?.supportedValuesOf;
    if (typeof fn === "function") {
      const all = fn.call(Intl, "timeZone") as string[];
      if (Array.isArray(all) && all.length) return all;
    }
  } catch {
    /* ignore */
  }
  return TZ_FALLBACK;
}


const COMMON_LOCALES = [
  "en-US", "en-GB", "en-CA", "en-AU",
  "fr-FR", "de-DE", "es-ES", "pt-BR",
  "it-IT", "ja-JP", "zh-CN", "zh-TW",
];

function getLocaleOptions(current?: string): string[] {
  const fromBrowser = Array.isArray((navigator as any)?.languages)
    ? (navigator as any).languages as string[]
    : [];
  const uniq = new Set<string>([...fromBrowser, ...COMMON_LOCALES]);
  if (current) uniq.add(current);
  // Keep short and readable; put en-US first if present
  const list = Array.from(uniq).sort(Intl.Collator().compare);
  const idx = list.indexOf("en-US");
  if (idx > 0) {
    list.splice(idx, 1);
    list.unshift("en-US");
  }
  return list;
}

/* ------------------------------- component ------------------------------ */

type ProfileTabProps = {
  onDirtyChange?: (dirty: boolean) => void;
  saveHandleRef?: (h: { submit: () => void }) => void;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  timezone: string;
  locale: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal: string;
  country: string;
  avatarUrl: string;
};

const toForm = (p: MeProfile | null): FormState => ({
  name: p?.name ?? "",
  email: p?.email ?? "",
  phone: (p as any)?.phone ?? "",
  timezone: (p as any)?.timezone ?? "",
  locale: (p as any)?.locale ?? "",
  address1: (p as any)?.address1 ?? "",
  address2: (p as any)?.address2 ?? "",
  city: (p as any)?.city ?? "",
  state: (p as any)?.state ?? "",
  postal: (p as any)?.postal ?? "",
  country: (p as any)?.country ?? "",
  avatarUrl: (p as any)?.avatarUrl ?? (p as any)?.avatar_url ?? "",
});

function diffPatch(original: FormState, current: FormState) {
  const patch: Record<string, string | null> = {};
  (Object.keys(original) as (keyof FormState)[]).forEach((k) => {
    const a = (original[k] ?? "").trim();
    const b = (current[k] ?? "").trim();
    if (a !== b) patch[k] = b.length ? b : null;
  });
  return patch;
}

export default function ProfileTab({ onDirtyChange, saveHandleRef }: ProfileTabProps) {
  const { push } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  const [original, setOriginal] = React.useState<FormState>(() => toForm(null));
  const [form, setForm] = React.useState<FormState>(() => toForm(null));

  // dynamic options
  const [timeZones, setTimeZones] = React.useState<string[]>([]);
  const [locales, setLocales] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMyProfile();
        if (cancelled) return;
        const f = toForm(me);
        setOriginal(f);
        setForm(f);

        // options
        const tz = getAllTimeZones();
        // make a nice sort: current tz first, then rest alpha
        const sorted = [...tz].sort(Intl.Collator().compare);
        if (f.timezone) {
          const i = sorted.indexOf(f.timezone);
          if (i > 0) {
            sorted.splice(i, 1);
            sorted.unshift(f.timezone);
          } else if (i === -1) {
            sorted.unshift(f.timezone);
          }
        }
        setTimeZones(sorted);

        setLocales(getLocaleOptions(f.locale));
      } catch (e: any) {
        push({
          title: "Failed to load profile",
          desc: e?.message ?? "Request failed",
          kind: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = React.useMemo(
    () => JSON.stringify(original) !== JSON.stringify(form),
    [original, form]
  );

  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const submit = React.useCallback(async () => {
    if (!dirty) {
      push({ title: "No changes to save" });
      return;
    }
    setSaving(true);
    try {
      const patch = diffPatch(original, form);
      const updated = await updateMyProfile(patch);
      const next = toForm(updated);
      setOriginal(next);
      setForm(next);
      push({ title: "Profile updated", kind: "success" });
    } catch (e: any) {
      push({
        title: "Save failed",
        desc: e?.message ?? "Request failed",
        kind: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [dirty, original, form, push]);

  React.useEffect(() => {
    saveHandleRef?.({ submit });
  }, [saveHandleRef, submit]);

  const update =
    <K extends keyof FormState>(key: K) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((s) => ({ ...s, [key]: e.target.value }));

  /* --------------------------- avatar upload --------------------------- */
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const validateFile = (file: File) => {
    const okTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const maxBytes =
      (Number(process.env.NEXT_PUBLIC_AVATAR_MAX_MB) || 5) * 1024 * 1024;
    if (!okTypes.includes(file.type)) {
      throw new Error("Please upload a PNG, JPG, WEBP, or GIF image.");
    }
    if (file.size > maxBytes) {
      throw new Error(`Max file size is ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
    }
  };

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("file", file, file.name || "avatar.png");

    const res = await fetch("/api/users/me/avatar", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!res.ok) {
      let msg = "";
      try {
        msg = (await res.json())?.message || "";
      } catch { }
      if (!msg) try { msg = await res.text(); } catch { }
      throw new Error(msg || `Upload failed (${res.status})`);
    }
    const data = (await res.json()) as { url?: string; avatarUrl?: string };
    const url = data.url || data.avatarUrl;
    if (!url) throw new Error("Upload succeeded, but server did not return a URL.");
    return url;
  }

  const onChooseFile = () => fileInputRef.current?.click();

  const onFilePicked = async (file?: File | null) => {
    if (!file) return;
    try {
      validateFile(file);
      setUploading(true);
      const localUrl = URL.createObjectURL(file);
      setForm((s) => ({ ...s, avatarUrl: localUrl }));

      const remoteUrl = await uploadAvatar(file);
      // cache-bust in case the same filename is reused
      const withBuster = `${remoteUrl}${remoteUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
      setForm((s) => ({ ...s, avatarUrl: withBuster }));
      push({ title: "Avatar uploaded", kind: "success" });
    } catch (e: any) {
      setForm((s) => ({ ...s, avatarUrl: original.avatarUrl }));
      push({ title: "Upload failed", desc: e?.message ?? String(e), kind: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) await onFilePicked(file);
  };

  const removeAvatar = () => {
    setForm((s) => ({ ...s, avatarUrl: "" })); // will send null on save
  };

  /* --------------------------------- UI -------------------------------- */

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your avatar, personal details, and preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <LoadingShimmer />
        ) : (
          <>
            {/* Avatar section */}
            <div className="flex items-start gap-4">
              <div className="relative">
                <AvatarPreview url={form.avatarUrl} name={form.name} />
                {uploading && (
                  <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white text-xs">
                    Uploading…
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div
                  className={`rounded-md border border-dashed p-4 ${dragOver ? "bg-muted/50" : "bg-muted/20"
                    }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  role="button"
                  aria-label="Drop an image to upload"
                  tabIndex={0}
                >
                  <div className="text-sm text-muted-foreground">
                    Drag & drop an image here, or{" "}
                    <button
                      type="button"
                      onClick={onChooseFile}
                      className="underline underline-offset-4"
                    >
                      choose a file
                    </button>
                    . PNG, JPG, WEBP, or GIF. Max {(Number(process.env.NEXT_PUBLIC_AVATAR_MAX_MB) || 5)} MB.
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" onClick={onChooseFile} disabled={uploading}>
                    Change avatar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={removeAvatar}
                    disabled={uploading || !form.avatarUrl}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name">
                <Input value={form.name} onChange={update("name")} placeholder="Your name" />
              </Field>

              <Field label="Email">
                <Input value={form.email} onChange={update("email")} type="email" placeholder="you@company.com" />
              </Field>

              <Field label="Phone">
                <Input value={form.phone} onChange={update("phone")} placeholder="+1 555 123 4567" />
              </Field>

              {/* Time zone select */}
              <Field label="Time zone">
                <select
                  value={form.timezone}
                  onChange={update("timezone")}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{timeZones.length ? "Select time zone..." : "Loading…"}</option>
                  {timeZones.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </Field>

              {/* Locale select */}
              <Field label="Locale">
                <select
                  value={form.locale}
                  onChange={update("locale")}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{locales.length ? "Select locale..." : "Loading…"}</option>
                  {locales.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </Field>

              <Field label="Address 1">
                <Input value={form.address1} onChange={update("address1")} placeholder="Street, number" />
              </Field>

              <Field label="Address 2">
                <Input value={form.address2} onChange={update("address2")} placeholder="Suite, apt, etc." />
              </Field>

              <Field label="City">
                <Input value={form.city} onChange={update("city")} placeholder="City" />
              </Field>

              <Field label="State / Region">
                <Input value={form.state} onChange={update("state")} placeholder="State or region" />
              </Field>

              <Field label="Postal code">
                <Input value={form.postal} onChange={update("postal")} placeholder="Postal / ZIP" />
              </Field>

              <Field label="Country">
                <Input value={form.country} onChange={update("country")} placeholder="Country" />
              </Field>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={submit} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {!dirty && <span className="text-sm text-muted-foreground">All changes saved</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function LoadingShimmer() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-9 w-full rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function AvatarPreview({ url, name }: { url?: string; name?: string }) {
  const initials =
    (name || "")
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Avatar"
      className="h-20 w-20 rounded-full object-cover border"
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className="h-20 w-20 rounded-full grid place-items-center border bg-muted text-sm font-medium">
      {initials}
    </div>
  );
}
