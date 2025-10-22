// app/administration/tabs/SmtpTab.tsx

"use client";

import * as React from "react";
import {
    Card,
    CardHeader,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
    EmailPurpose,
    EmailProfile,
    SmtpSettings,
    ImapSettings,
    PopSettings,
    ToastFn,
    ToastKind,
} from "../types";

/* ================== Toast kind mapping ================== */
const TK = {
    success: "success" as ToastKind,
    error: "destructive" as ToastKind,
    info: "default" as ToastKind,
};

/* ================== strings ================== */
const STR = {
    title: "SMTP",
    desc:
        "Configure outbound email. Optionally set up IMAP/POP for inbox processing. Each purpose can use its own profile.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    restore: "Restore defaults",
    testConn: "Test connection",
    sendTest: "Send test…",
    lastUpdated: "Last updated",
    unsaved: "Unsaved changes",
    smtpLegend: "SMTP (outbound)",
    imapLegend: "IMAP (optional)",
    popLegend: "POP (optional)",
    dkimLegend: "DKIM (domain keys)",
    statusLegend: "Profile status & notes",
    disabledBannerTitle: "This profile is disabled",
    disabledBannerDesc:
        "Messages for this purpose will be queued but not sent.",
    imapHint:
        "Fill in any field to enable IMAP. Leave all blank to keep disabled.",
    popHint:
        "Fill in any field to enable POP. Leave all blank to keep disabled.",
    testRunning: "Testing",
    testSlow:
        "If this takes more than a few seconds, check firewall and credentials.",
    preset: "Preset",
    host: "Host",
    port: "Port",
    username: "Username",
    password: "Password",
    from: "From address",
    tls: "TLS (STARTTLS)",
    ssl: "SSL (SMTPS)",
    sslShort: "SSL",
    imapEnableCopy: "Enable IMAP for bounce/ingest processing.",
    popEnableCopy: "Enable POP as an alternative to IMAP (mutually exclusive).",
    enabled: "Enabled",
    sendTestTitle: "Send test email",
    sendTestDesc: "Choose a sending profile and a recipient address.",
    profile: "Profile",
    to: "To",
    subject: "Subject",
    body: "Body",
    testSubject: "Test from RemoteIQ",
    testBody: "This is a test email from RemoteIQ.",
    pwdNeverShown:
        "Password is never shown. Leave unchanged to keep existing secret.",
    setChangePwd: "Set/Change password",
    editPwd: "Edit password",
    cancelPwd: "Cancel",
    purpose: "Purpose",
    copyFrom: "Copy from…",
    sesRegion: "SES region",
    // DKIM
    domain: "Domain",
    selector: "Selector",
    publicKey: "Public key (TXT)",
    dnsCheck: "Check DNS",
    checking: "Checking…",
    dkimStatusUnknown: "Unknown",
    dkimStatusValid: "Valid",
    dkimStatusInvalid: "Invalid",
};

/* ================== local types/state ================== */
type TestKind = "smtp" | "imap" | "pop" | "send";
type TestOutcome = { ok: boolean; message?: string };

type DkimState = {
    domain: string;
    selector: string;
    publicKey: string;
    status?: "unknown" | "valid" | "invalid" | "checking";
    lastCheckedAt?: string;
    lastResult?: string | null;
};

type ProfileState = EmailProfile & {
    _passwordEdited?: boolean;
    _imapPwdEdited?: boolean;
    _popPwdEdited?: boolean;
    _smtpTest?: TestOutcome | null;
    _imapTest?: TestOutcome | null;
    _popTest?: TestOutcome | null;
    _imapEnabled?: boolean;
    _popEnabled?: boolean;
};

type SmtpState = {
    profiles: Record<EmailPurpose, ProfileState>;
    dkim: DkimState;
    loading: boolean;
    saving: boolean;
    testing?: { purpose: EmailPurpose; kind: TestKind } | null;
    lastSaved?: Record<EmailPurpose, EmailProfile>;
    lastSavedDkim?: DkimState;
    lastUpdated?: string;
};

const PURPOSES: EmailPurpose[] = [
    "alerts",
    "invites",
    "password_resets",
    "reports",
];
const friendlyPurpose: Record<EmailPurpose, string> = {
    alerts: "Alerts",
    invites: "Invites",
    password_resets: "Password resets",
    reports: "Reports",
};

/* ================== defaults ================== */
const emptySmtp = (): SmtpSettings => ({
    host: "",
    port: "",
    username: "",
    password: "",
    useTLS: true,
    useSSL: false,
    fromAddress: "",
});
const emptyImap = (): ImapSettings => ({
    host: "",
    port: "",
    username: "",
    password: "",
    useSSL: true,
});
const emptyPop = (): PopSettings => ({
    host: "",
    port: "",
    username: "",
    password: "",
    useSSL: true,
});
const emptyProfile = (): ProfileState => ({
    smtp: emptySmtp(),
    imap: emptyImap(),
    pop: emptyPop(),
    enabled: true,
});
const emptyDkim = (): DkimState => ({
    domain: "",
    selector: "",
    publicKey: "",
    status: "unknown",
    lastCheckedAt: undefined,
    lastResult: null,
});

/* ================== presets ================== */
type SmtpPresetKey = "gmail" | "office365" | "sendgrid" | "ses" | "custom";
type SmtpPreset = {
    key: SmtpPresetKey;
    label: string;
    host: string;
    port: number;
    tls: boolean;
    ssl: boolean;
    hint?: string;
};
const SMTP_PRESETS: SmtpPreset[] = [
    {
        key: "gmail",
        label: "Gmail",
        host: "smtp.gmail.com",
        port: 587,
        tls: true,
        ssl: false,
        hint: "Username = full email; App Password required",
    },
    {
        key: "office365",
        label: "Microsoft 365",
        host: "smtp.office365.com",
        port: 587,
        tls: true,
        ssl: false,
        hint: "Username = mailbox UPN",
    },
    {
        key: "sendgrid",
        label: "SendGrid",
        host: "smtp.sendgrid.net",
        port: 587,
        tls: true,
        ssl: false,
        hint: "Username = apikey; Password = API key",
    },
    {
        key: "ses",
        label: "Amazon SES",
        host: "email-smtp.<region>.amazonaws.com",
        port: 587,
        tls: true,
        ssl: false,
        hint: "Replace <region> (e.g., us-east-1)",
    },
    { key: "custom", label: "Custom", host: "", port: 587, tls: true, ssl: false },
];

/* SES helper */
const SES_REGION_OPTIONS = [
    "us-east-1",
    "us-east-2",
    "us-west-2",
    "eu-west-1",
    "eu-west-2",
    "eu-central-1",
    "ap-south-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ca-central-1",
];

/* ================== API adapter ================== */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;
type ApiConfigResponse = {
    profiles: Record<EmailPurpose, EmailProfile>;
    dkim?: DkimState | null;
    lastUpdated?: string;
};
type ApiTestResponse = { ok: boolean; result?: string };

async function safeText(res: Response, fallback: string) {
    try {
        return (await res.text()) || fallback;
    } catch {
        return fallback;
    }
}
async function getEmailConfig(): Promise<ApiConfigResponse> {
    const res = await fetch(apiUrl("/api/admin/email"), {
        credentials: "include",
    });
    if (!res.ok)
        throw new Error(await safeText(res, "Failed to load email settings"));
    return res.json();
}
async function saveEmailConfig(payload: {
    profiles: Record<EmailPurpose, EmailProfile>;
    dkim?: DkimState;
}) {
    // If your backend only supports /save for profiles, it will ignore unknown fields.
    const res = await fetch(apiUrl("/api/admin/email/save"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok)
        throw new Error(await safeText(res, "Failed to save email settings"));
}
async function saveDkimConfig(dkim: DkimState) {
    // Optional: if you later add a dedicated DKIM save
    const res = await fetch(apiUrl("/api/admin/email/save-dkim"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dkim }),
    });
    if (!res.ok) throw new Error(await safeText(res, "Failed to save DKIM"));
}
async function testSmtp(payload: {
    profile: EmailPurpose;
    to?: string;
}): Promise<ApiTestResponse> {
    const res = await fetch(apiUrl("/api/admin/email/test-smtp"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await safeText(res, "SMTP test failed"));
    return res.json();
}
async function testImap(payload: {
    profile: EmailPurpose;
}): Promise<ApiTestResponse> {
    const res = await fetch(apiUrl("/api/admin/email/test-imap"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await safeText(res, "IMAP test failed"));
    return res.json();
}
async function testPop(payload: {
    profile: EmailPurpose;
}): Promise<ApiTestResponse> {
    const res = await fetch(apiUrl("/api/admin/email/test-pop"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await safeText(res, "POP test failed"));
    return res.json();
}
async function sendTestEmail(payload: {
    profile: EmailPurpose;
    to: string;
    subject?: string;
    body?: string;
}) {
    const res = await fetch(apiUrl("/api/admin/email/send-test"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok)
        throw new Error(await safeText(res, "Failed to send test email"));
    return res.json() as Promise<{ ok: boolean; result?: string }>;
}
async function dkimDnsCheck(domain: string, selector: string) {
    // Graceful: if backend doesn't exist, show toast but don't break
    const res = await fetch(apiUrl("/api/admin/email/dns-check"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, selector }),
    });
    if (!res.ok) {
        const msg = await safeText(
            res,
            "DNS check endpoint not available on backend"
        );
        throw new Error(msg);
    }
    return (await res.json()) as {
        ok: boolean;
        status: "valid" | "invalid";
        txt?: string;
        result?: string;
        checkedAt?: string;
    };
}

/* ================== utils ================== */
function deepClone<T>(x: T): T {
    return JSON.parse(JSON.stringify(x));
}
function isEmail(s: string) {
    return /.+@.+\..+/.test(s);
}
function numberOrEmpty(n: number | "") {
    return n === "" ? "" : Number(n) || "";
}
function timeAgo(iso?: string) {
    if (!iso) return "—";
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleString();
}
function trimIfString<T>(v: T): T {
    return (typeof v === "string" ? (v as unknown as string).trim() : v) as T;
}

/* ================== validation helpers (SCOPED!) ================== */
function isSmtpLooksValid(p: ProfileState) {
    return !!(
        p.smtp.host &&
        p.smtp.port &&
        p.smtp.fromAddress &&
        isEmail(p.smtp.fromAddress) &&
        !(p.smtp.useSSL && p.smtp.useTLS)
    );
}
function imapLooksValid(p: ProfileState) {
    if (!p._imapEnabled) return false;
    const im = p.imap;
    return !!(
        im.host &&
        im.port &&
        im.username &&
        (im.password || !p._imapPwdEdited)
    );
}
function popLooksValid(p: ProfileState) {
    if (!p._popEnabled) return false;
    const po = p.pop;
    return !!(
        po.host &&
        po.port &&
        po.username &&
        (po.password || !p._popPwdEdited)
    );
}
function validateProfile(p: ProfileState): { ok: boolean; messages: string[] } {
    const msgs: string[] = [];
    if (!p.smtp.host?.trim()) msgs.push("SMTP host is required");
    if (!p.smtp.port || Number(p.smtp.port) < 1 || Number(p.smtp.port) > 65535)
        msgs.push("SMTP port must be 1–65535");
    if (!p.smtp.fromAddress || !isEmail(p.smtp.fromAddress))
        msgs.push("From address must be a valid email");
    if (p.smtp.useSSL && p.smtp.useTLS)
        msgs.push("TLS and SSL are mutually exclusive");

    const imapEnabled = !!p._imapEnabled;
    const popEnabled = !!p._popEnabled;
    if (imapEnabled && popEnabled)
        msgs.push("IMAP and POP are mutually exclusive; configure only one");

    if (imapEnabled) {
        const im = p.imap;
        if (!im.host || !im.port || !im.username || (!im.password && p._imapPwdEdited))
            msgs.push("IMAP requires host, port, username, password");
        if (im.port && (Number(im.port) < 1 || Number(im.port) > 65535))
            msgs.push("IMAP port must be 1–65535");
    }
    if (popEnabled) {
        const po = p.pop;
        if (!po.host || !po.port || !po.username || (!po.password && p._popPwdEdited))
            msgs.push("POP requires host, port, username, password");
        if (po.port && (Number(po.port) < 1 || Number(po.port) > 65535))
            msgs.push("POP port must be 1–65535");
    }
    return { ok: msgs.length === 0, messages: msgs };
}
function applyPreset(preset: SmtpPreset, prev: SmtpSettings): SmtpSettings {
    const next = { ...prev };
    next.host = preset.host;
    next.port = preset.port;
    next.useTLS = preset.tls;
    next.useSSL = preset.ssl;
    return next;
}

/* SES helpers */
function extractSesRegion(host: string): string | null {
    const m = host.match(/^email-smtp\.([a-z0-9-]+)\.amazonaws\.com$/);
    return m ? m[1] : null;
}
function buildSesHost(region: string) {
    return `email-smtp.${region}.amazonaws.com`;
}

/* ================== layout helpers ================== */
function AdminSectionHeader({
    title,
    description,
}: {
    title: string;
    description?: string;
}) {
    return (
        <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {title}
            </h2>
            {description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {description}
                </p>
            ) : null}
        </div>
    );
}

function SectionLegend({ children }: { children: React.ReactNode }) {
    return (
        <legend className="px-1 text-base md:text-lg font-semibold tracking-tight">
            {children}
        </legend>
    );
}

/* ================== compare sanitizers ================== */
function sanitizeProfileForCompare(p: ProfileState): EmailProfile {
    const c = JSON.parse(JSON.stringify(p)) as ProfileState;

    delete (c as any)._passwordEdited;
    delete (c as any)._imapPwdEdited;
    delete (c as any)._popPwdEdited;
    delete (c as any)._smtpTest;
    delete (c as any)._imapTest;
    delete (c as any)._popTest;
    const imapEnabled = !!c._imapEnabled;
    const popEnabled = !!c._popEnabled;
    delete (c as any)._imapEnabled;
    delete (c as any)._popEnabled;

    if (c.smtp) delete (c.smtp as any).password;
    if (c.imap) delete (c.imap as any).password;
    if (c.pop) delete (c.pop as any).password;

    const normPort = (x: any) => (x === "" || x === undefined ? undefined : x);
    if (c.smtp) (c.smtp as any).port = normPort(c.smtp.port);
    if (c.imap) (c.imap as any).port = normPort(c.imap.port);
    if (c.pop) (c.pop as any).port = normPort(c.pop.port);

    const trimObj = (obj: Record<string, any> | undefined) => {
        if (!obj) return;
        for (const k of Object.keys(obj)) obj[k] = trimIfString(obj[k]);
    };
    trimObj(c.smtp as any);
    trimObj(c.imap as any);
    trimObj(c.pop as any);

    if (!imapEnabled) {
        c.imap = {
            host: "",
            port: undefined as any,
            username: "",
            password: undefined as any,
            useSSL: true,
        };
    }
    if (!popEnabled) {
        c.pop = {
            host: "",
            port: undefined as any,
            username: "",
            password: undefined as any,
            useSSL: true,
        };
    }

    return {
        enabled: !!c.enabled,
        smtp: c.smtp,
        imap: c.imap,
        pop: c.pop,
    };
}
function sanitizeSavedForCompare(saved: EmailProfile): EmailProfile {
    const s = JSON.parse(JSON.stringify(saved)) as EmailProfile;

    if (s.smtp) delete (s.smtp as any).password;
    if (s.imap) delete (s.imap as any).password;
    if (s.pop) delete (s.pop as any).password;

    const normPort = (x: any) => (x === "" || x === undefined ? undefined : x);
    if (s.smtp) (s.smtp as any).port = normPort(s.smtp.port);
    if (s.imap) (s.imap as any).port = normPort(s.imap.port);
    if (s.pop) (s.pop as any).port = normPort(s.pop.port);

    const trimObj = (obj: Record<string, any> | undefined) => {
        if (!obj) return;
        for (const k of Object.keys(obj)) obj[k] = trimIfString(obj[k]);
    };
    trimObj(s.smtp as any);
    trimObj(s.imap as any);
    trimObj(s.pop as any);

    const blankBlock = (b?: any) =>
        !b || (!b.host && !b.port && !b.username && !b.password);
    if (blankBlock(s.imap)) {
        s.imap = {
            host: "",
            port: undefined as any,
            username: "",
            password: undefined as any,
            useSSL: true,
        };
    }
    if (blankBlock(s.pop)) {
        s.pop = {
            host: "",
            port: undefined as any,
            username: "",
            password: undefined as any,
            useSSL: true,
        };
    }

    return s;
}
function sanitizeDkimForCompare(d: DkimState | undefined | null): Required<Pick<DkimState, "domain" | "selector" | "publicKey">> {
    return {
        domain: (d?.domain || "").trim(),
        selector: (d?.selector || "").trim(),
        publicKey: (d?.publicKey || "").trim(),
    };
}

/* ================== hook: useSmtpState ================== */
function useSmtpState(push: ToastFn) {
    const [state, setState] = React.useState<SmtpState>({
        profiles: {
            alerts: emptyProfile(),
            invites: emptyProfile(),
            password_resets: emptyProfile(),
            reports: emptyProfile(),
        },
        dkim: emptyDkim(),
        loading: true,
        saving: false,
        testing: null,
        lastSaved: undefined,
        lastSavedDkim: undefined,
        lastUpdated: undefined,
    });

    // ----- beforeunload guard -----
    const dirtyRef = React.useRef(false);
    React.useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (dirtyRef.current) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    // ----- load from API -----
    const load = React.useCallback(async () => {
        setState((s) => ({ ...s, loading: true }));
        try {
            const data = await getEmailConfig();
            const merged: Record<EmailPurpose, ProfileState> = deepClone(
                state.profiles
            );
            for (const p of PURPOSES) {
                const incoming = data.profiles?.[p];
                if (incoming) {
                    merged[p] = {
                        ...merged[p],
                        ...incoming,
                        smtp: { ...merged[p].smtp, ...incoming.smtp, password: "" },
                        imap: { ...merged[p].imap, ...incoming.imap, password: "" },
                        pop: { ...merged[p].pop, ...incoming.pop, password: "" },
                        _passwordEdited: false,
                        _imapPwdEdited: false,
                        _popPwdEdited: false,
                        _smtpTest: null,
                        _imapTest: null,
                        _popTest: null,
                        _imapEnabled: !!(
                            incoming?.imap?.host ||
                            incoming?.imap?.port ||
                            incoming?.imap?.username ||
                            (incoming as any)?.imap?.password
                        ),
                        _popEnabled: !!(
                            incoming?.pop?.host ||
                            incoming?.pop?.port ||
                            incoming?.pop?.username ||
                            (incoming as any)?.pop?.password
                        ),
                    };
                    if (merged[p]._imapEnabled && merged[p]._popEnabled)
                        merged[p]._popEnabled = false;

                    // normalize UI ports
                    merged[p].smtp.port = (merged[p].smtp.port as any) ?? "";
                    merged[p].imap.port = (merged[p].imap.port as any) ?? "";
                    merged[p].pop.port = (merged[p].pop.port as any) ?? "";
                }
            }

            const dkim = data.dkim
                ? {
                    ...emptyDkim(),
                    ...data.dkim,
                    status: data.dkim?.status ?? "unknown",
                    lastResult: data.dkim?.lastResult ?? null,
                    lastCheckedAt: data.dkim?.lastCheckedAt,
                }
                : emptyDkim();

            setState({
                profiles: merged,
                dkim,
                loading: false,
                saving: false,
                testing: null,
                lastSaved: deepClone(data.profiles),
                lastSavedDkim: deepClone(dkim),
                lastUpdated: data.lastUpdated,
            });
        } catch (e: any) {
            setState((s) => ({ ...s, loading: false }));
            push({
                kind: TK.error,
                title: "Failed to load SMTP settings",
                desc: e?.message || "Request failed",
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    // ----- profile mutators -----
    const setNested = React.useCallback(
        (purpose: EmailPurpose, path: string[], value: any) => {
            setState((s) => {
                const next = deepClone(s);
                let t: any = next.profiles[purpose];
                for (let i = 0; i < path.length - 1; i++) t = t[path[i]];
                t[path[path.length - 1]] = value;
                return next;
            });
        },
        []
    );

    const toggleTLS_SSL = React.useCallback(
        (purpose: EmailPurpose, which: "tls" | "ssl", checked: boolean) => {
            setState((s) => {
                const next = deepClone(s);
                const smtp = next.profiles[purpose].smtp;
                if (which === "tls") {
                    smtp.useTLS = checked;
                    if (checked) smtp.useSSL = false;
                } else {
                    smtp.useSSL = checked;
                    if (checked) smtp.useTLS = false;
                }
                return next;
            });
        },
        []
    );

    const preset = React.useCallback((purpose: EmailPurpose, key: SmtpPresetKey) => {
        setState((s) => {
            const next = deepClone(s);
            const p = SMTP_PRESETS.find((x) => x.key === key)!;
            next.profiles[purpose].smtp = applyPreset(
                p,
                next.profiles[purpose].smtp
            );
            return next;
        });
    }, []);

    const copyFrom = React.useCallback((dest: EmailPurpose, src: EmailPurpose) => {
        setState((s) => {
            const next = deepClone(s);
            const from = next.profiles[src];
            const to = next.profiles[dest];

            to.enabled = from.enabled;
            to.smtp = { ...to.smtp, ...from.smtp, password: "" };
            to._passwordEdited = false;
            to.imap = { ...to.imap, ...from.imap, password: "" };
            to._imapPwdEdited = false;
            to.pop = { ...to.pop, ...from.pop, password: "" };
            to._popPwdEdited = false;

            to._imapEnabled = !!(to.imap.host || to.imap.port || to.imap.username);
            to._popEnabled = !!(to.pop.host || to.pop.port || to.pop.username);
            if (to._imapEnabled && to._popEnabled) to._popEnabled = false;

            to._smtpTest = null;
            to._imapTest = null;
            to._popTest = null;

            to.smtp.port = (to.smtp.port as any) ?? "";
            to.imap.port = (to.imap.port as any) ?? "";
            to.pop.port = (to.pop.port as any) ?? "";

            return next;
        });
    }, []);

    const setDkim = React.useCallback((patch: Partial<DkimState>) => {
        setState((s) => ({ ...s, dkim: { ...s.dkim, ...patch } }));
    }, []);

    const revert = React.useCallback(() => {
        if (!state.lastSaved) return;
        setState((s) => {
            const next = deepClone(s);
            for (const purpose of PURPOSES) {
                const incoming = state.lastSaved![purpose];
                if (!incoming) continue;
                next.profiles[purpose] = {
                    ...next.profiles[purpose],
                    ...incoming,
                    smtp: {
                        ...next.profiles[purpose].smtp,
                        ...incoming.smtp,
                        password: "",
                    },
                    imap: {
                        ...next.profiles[purpose].imap,
                        ...incoming.imap,
                        password: "",
                    },
                    pop: {
                        ...next.profiles[purpose].pop,
                        ...incoming.pop,
                        password: "",
                    },
                    _passwordEdited: false,
                    _imapPwdEdited: false,
                    _popPwdEdited: false,
                    _imapEnabled: !!(
                        incoming?.imap?.host ||
                        incoming?.imap?.port ||
                        incoming?.imap?.username ||
                        (incoming as any)?.imap?.password
                    ),
                    _popEnabled: !!(
                        incoming?.pop?.host ||
                        incoming?.pop?.port ||
                        incoming?.pop?.username ||
                        (incoming as any)?.pop?.password
                    ),
                };
                next.profiles[purpose].smtp.port =
                    (next.profiles[purpose].smtp.port as any) ?? "";
                next.profiles[purpose].imap.port =
                    (next.profiles[purpose].imap.port as any) ?? "";
                next.profiles[purpose].pop.port =
                    (next.profiles[purpose].pop.port as any) ?? "";
            }
            if (state.lastSavedDkim) next.dkim = deepClone(state.lastSavedDkim);
            return next;
        });
    }, [state.lastSaved, state.lastSavedDkim]);

    // ---- SAVE ALL (profiles + DKIM) ----
    const saveAll = React.useCallback(async () => {
        // Build payload for profiles
        const payload: Record<EmailPurpose, EmailProfile> = {
            alerts: undefined as any,
            invites: undefined as any,
            password_resets: undefined as any,
            reports: undefined as any,
        };

        for (const purpose of PURPOSES) {
            const p = deepClone(state.profiles[purpose]);
            const out: EmailProfile = {
                enabled: p.enabled,
                smtp: { ...p.smtp },
                imap: { ...p.imap },
                pop: { ...p.pop },
            };

            if (!p._passwordEdited) delete (out.smtp as any).password;
            if (!p._imapPwdEdited) delete (out.imap as any).password;
            if (!p._popPwdEdited) delete (out.pop as any).password;

            if (out.smtp.port === "") (out.smtp as any).port = undefined;
            if (out.imap.port === "") (out.imap as any).port = undefined;
            if (out.pop.port === "") (out.pop as any).port = undefined;

            if (!p._imapEnabled) {
                out.imap = {
                    host: "",
                    port: undefined as any,
                    username: "",
                    password: undefined as any,
                    useSSL: true,
                };
            }
            if (!p._popEnabled) {
                out.pop = {
                    host: "",
                    port: undefined as any,
                    username: "",
                    password: undefined as any,
                    useSSL: true,
                };
            }
            payload[purpose] = out;
        }

        const dkimPayload = {
            domain: (state.dkim.domain || "").trim(),
            selector: (state.dkim.selector || "").trim(),
            publicKey: (state.dkim.publicKey || "").trim(),
            status: state.dkim.status ?? "unknown",
            lastCheckedAt: state.dkim.lastCheckedAt,
            lastResult: state.dkim.lastResult ?? null,
        } as DkimState;

        setState((s) => ({ ...s, saving: true }));
        try {
            // Try single save with bundled payload first
            await saveEmailConfig({ profiles: payload, dkim: dkimPayload });

            // sanitize snapshot (no secrets) and set UI state to canonical
            const snapshot = deepClone(payload);
            for (const purpose of PURPOSES) {
                delete (snapshot[purpose].smtp as any).password;
                delete (snapshot[purpose].imap as any).password;
                delete (snapshot[purpose].pop as any).password;
            }

            setState((s) => {
                const next = deepClone(s);
                for (const purpose of PURPOSES) {
                    const saved = snapshot[purpose];
                    const prof = next.profiles[purpose];

                    prof.enabled = saved.enabled;
                    prof.smtp = { ...prof.smtp, ...saved.smtp, password: "" };
                    prof.imap = { ...prof.imap, ...saved.imap, password: "" };
                    prof.pop = { ...prof.pop, ...saved.pop, password: "" };

                    prof.smtp.port = (saved.smtp.port as any) ?? "";
                    prof.imap.port = (saved.imap.port as any) ?? "";
                    prof.pop.port = (saved.pop.port as any) ?? "";

                    prof._passwordEdited = false;
                    prof._imapPwdEdited = false;
                    prof._popPwdEdited = false;

                    prof._imapEnabled = !!(
                        saved.imap?.host ||
                        saved.imap?.port ||
                        saved.imap?.username
                    );
                    prof._popEnabled = !!(
                        saved.pop?.host ||
                        saved.pop?.port ||
                        saved.pop?.username
                    );
                    if (prof._imapEnabled && prof._popEnabled) prof._popEnabled = false;
                }

                next.lastSaved = snapshot;
                next.lastSavedDkim = deepClone(dkimPayload);
                next.lastUpdated = new Date().toISOString();
                next.saving = false;
                return next;
            });

            push({
                kind: TK.success,
                title: "SMTP & DKIM saved",
                desc: "Your changes were saved successfully.",
            });
        } catch (e: any) {
            // fallback: if server doesn't accept DKIM in the combined payload, try profile-only save
            try {
                await saveEmailConfig({ profiles: payload });
                // Optional: attempt dedicated DKIM save (if backend supports it); ignore failure
                try {
                    await saveDkimConfig(dkimPayload);
                } catch {
                    // ignore if not present
                }

                const snapshot = deepClone(payload);
                for (const purpose of PURPOSES) {
                    delete (snapshot[purpose].smtp as any).password;
                    delete (snapshot[purpose].imap as any).password;
                    delete (snapshot[purpose].pop as any).password;
                }
                setState((s) => {
                    const next = deepClone(s);
                    for (const purpose of PURPOSES) {
                        const saved = snapshot[purpose];
                        const prof = next.profiles[purpose];

                        prof.enabled = saved.enabled;
                        prof.smtp = { ...prof.smtp, ...saved.smtp, password: "" };
                        prof.imap = { ...prof.imap, ...saved.imap, password: "" };
                        prof.pop = { ...prof.pop, ...saved.pop, password: "" };

                        prof.smtp.port = (saved.smtp.port as any) ?? "";
                        prof.imap.port = (saved.imap.port as any) ?? "";
                        prof.pop.port = (saved.pop.port as any) ?? "";

                        prof._passwordEdited = false;
                        prof._imapPwdEdited = false;
                        prof._popPwdEdited = false;

                        prof._imapEnabled = !!(
                            saved.imap?.host || saved.imap?.port || saved.imap?.username
                        );
                        prof._popEnabled = !!(
                            saved.pop?.host || saved.pop?.port || saved.pop?.username
                        );
                        if (prof._imapEnabled && prof._popEnabled) prof._popEnabled = false;
                    }
                    next.lastSaved = snapshot;
                    next.lastSavedDkim = deepClone(dkimPayload);
                    next.lastUpdated = new Date().toISOString();
                    next.saving = false;
                    return next;
                });

                push({
                    kind: TK.success,
                    title: "SMTP saved (DKIM attempted)",
                    desc:
                        "Profiles saved. DKIM saved if supported by backend.",
                });
            } catch (err: any) {
                setState((s) => ({ ...s, saving: false }));
                push({
                    kind: TK.error,
                    title: "Save failed",
                    desc: e?.message || err?.message || "Request failed",
                });
            }
        }
    }, [state.profiles, state.dkim, push]);

    const test = React.useCallback(
        async (kind: TestKind, purpose: EmailPurpose, to?: string) => {
            setState((s) => ({ ...s, testing: { kind, purpose } }));
            try {
                let result:
                    | ApiTestResponse
                    | { ok: boolean; result?: string }
                    | null = null;
                if (kind === "smtp") result = await testSmtp({ profile: purpose });
                if (kind === "imap") result = await testImap({ profile: purpose });
                if (kind === "pop") result = await testPop({ profile: purpose });
                if (kind === "send") {
                    if (!to) throw new Error("Recipient required");
                    result = await sendTestEmail({
                        profile: purpose,
                        to,
                        subject: STR.testSubject,
                        body: STR.testBody,
                    });
                }
                const outcome: TestOutcome = {
                    ok: !!(result as any)?.ok,
                    message: (result as any)?.result,
                };
                setState((s) => {
                    const next = deepClone(s);
                    const prof = next.profiles[purpose];
                    if (kind === "smtp") prof._smtpTest = outcome;
                    if (kind === "imap") prof._imapTest = outcome;
                    if (kind === "pop") prof._popTest = outcome;
                    next.testing = null;
                    return next;
                });

                push({
                    kind: outcome.ok ? TK.success : TK.error,
                    title: `${friendlyPurpose[purpose]} ${kind.toUpperCase()} ${outcome.ok ? "success" : "failed"
                        }`,
                    desc:
                        outcome.message ||
                        (outcome.ok ? undefined : "No error message returned"),
                });
            } catch (e: any) {
                setState((s) => ({ ...s, testing: null }));
                push({
                    kind: TK.error,
                    title: "Test failed",
                    desc: e?.message || "Request failed",
                });
            }
        },
        [push]
    );

    const restoreDefaults = React.useCallback(() => {
        setState((s) => ({
            ...s,
            profiles: {
                alerts: emptyProfile(),
                invites: emptyProfile(),
                password_resets: emptyProfile(),
                reports: emptyProfile(),
            },
            dkim: emptyDkim(),
        }));
    }, []);

    // ----- DIRTY calculation (profiles + DKIM) -----
    const dirty = React.useMemo(() => {
        if (!state.lastSaved) return false;

        // profiles
        for (const purpose of PURPOSES) {
            const currSan = sanitizeProfileForCompare(state.profiles[purpose]);
            const savedSan = sanitizeSavedForCompare(state.lastSaved[purpose]);
            if (JSON.stringify(currSan) !== JSON.stringify(savedSan)) {
                return true;
            }
        }

        // DKIM
        const currDkim = sanitizeDkimForCompare(state.dkim);
        const lastDkim = sanitizeDkimForCompare(state.lastSavedDkim);
        if (JSON.stringify(currDkim) !== JSON.stringify(lastDkim)) return true;

        return false;
    }, [state.profiles, state.lastSaved, state.dkim, state.lastSavedDkim]);

    React.useEffect(() => {
        dirtyRef.current = dirty;
    }, [dirty]);

    // ----- DKIM DNS check -----
    const checkDns = React.useCallback(async () => {
        const domain = (state.dkim.domain || "").trim();
        const selector = (state.dkim.selector || "").trim();
        if (!domain || !selector) {
            push({
                kind: TK.error,
                title: "Missing fields",
                desc: "Enter both domain and selector.",
            });
            return;
        }
        setDkim({ status: "checking" });
        try {
            const res = await dkimDnsCheck(domain, selector);
            const status = res.ok && res.status === "valid" ? "valid" : "invalid";
            setDkim({
                status,
                lastCheckedAt: res.checkedAt || new Date().toISOString(),
                lastResult: res.result || null,
            });
            push({
                kind: res.ok ? TK.success : TK.error,
                title: "DNS Check",
                desc:
                    res.result ||
                    (res.ok ? "DKIM record found and matches." : "Record not valid."),
            });
        } catch (e: any) {
            setDkim({ status: "unknown" });
            push({
                kind: TK.error,
                title: "DNS check failed",
                desc: e?.message || "Endpoint not available",
            });
        }
    }, [state.dkim.domain, state.dkim.selector, push, setDkim]);

    return {
        state,
        actions: {
            setNested,
            toggleTLS_SSL,
            preset,
            copyFrom,
            revert,
            saveAll,
            test,
            restoreDefaults,
            setDkim,
            checkDns,
        },
        dirty,
    } as const;
}

/* ================== small UI helpers ================== */
function Notice({
    title,
    children,
    variant = "default",
}: {
    title: string;
    children?: React.ReactNode;
    variant?: "default" | "destructive";
}) {
    return (
        <div
            className={cn(
                "w-full rounded-lg border p-3",
                variant === "destructive"
                    ? "border-red-300/60 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                    : "border-border/60 bg-muted/30"
            )}
            role="status"
            aria-live="polite"
        >
            <div className="text-sm font-medium">{title}</div>
            {children ? (
                <div className="mt-1 text-xs text-muted-foreground">{children}</div>
            ) : null}
        </div>
    );
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>
    );
}

function PasswordField({
    id,
    label,
    edited,
    onChange,
    onEdited,
}: {
    id: string;
    label: string;
    edited?: boolean;
    onChange: (v: string) => void;
    onEdited: (flag: boolean) => void;
}) {
    const [editing, setEditing] = React.useState(false);
    React.useEffect(() => {
        if (!edited) setEditing(false);
    }, [edited]);
    return (
        <div>
            <Label htmlFor={id}>{label}</Label>
            {editing ? (
                <div className="flex gap-2">
                    <Input
                        id={id}
                        type="password"
                        onChange={(e) => {
                            onChange(e.target.value);
                            onEdited(true);
                        }}
                        placeholder="Enter new password"
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            onChange("");
                            onEdited(false);
                            setEditing(false);
                        }}
                    >
                        {STR.cancelPwd}
                    </Button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <Input
                        id={id}
                        type="password"
                        value="••••••••"
                        disabled
                        aria-label={`${label} (hidden)`}
                    />
                    <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                        {edited ? STR.editPwd : STR.setChangePwd}
                    </Button>
                </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{STR.pwdNeverShown}</p>
        </div>
    );
}

function TestBadge({ outcome }: { outcome?: TestOutcome | null }) {
    if (!outcome) return null;
    return (
        <Badge variant={outcome.ok ? "default" : "destructive"}>
            {outcome.ok ? "Success" : "Failed"}
        </Badge>
    );
}

/* ================== main component ================== */
interface SmtpTabProps {
    push: ToastFn;
}

export default function SmtpTab({ push }: SmtpTabProps) {
    const { state, actions, dirty } = useSmtpState(push);
    const [activePurpose, setActivePurpose] =
        React.useState<EmailPurpose>("alerts");

    const activeProfile = state.profiles[activePurpose];
    const valid = validateProfile(activeProfile);

    /* derive SES UI visibility + region */
    const sesRegion = React.useMemo(
        () => extractSesRegion(activeProfile.smtp.host || ""),
        [activeProfile.smtp.host]
    );
    const showSesRegion = React.useMemo(() => {
        return (
            activeProfile.smtp.host.includes("email-smtp.") &&
            activeProfile.smtp.host.endsWith(".amazonaws.com")
        );
    }, [activeProfile.smtp.host]);

    return (
        <TabsContent value="smtp" className="mt-0">
            <Card className="relative">
                <CardHeader className="gap-3">
                    <div className="flex items-end justify-between gap-3">
                        <AdminSectionHeader title={STR.title} description={STR.desc} />
                        {/* SINGLE Save button (top-right) saves EVERYTHING on the tab */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>
                                        <Button
                                            disabled={state.saving || state.loading || !valid.ok || !dirty}
                                            onClick={actions.saveAll}
                                        >
                                            {state.saving ? STR.saving : STR.save}
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>Save all changes</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Toolbar row: Purpose dropdown + Copy From + Test dropdown + Send Test */}
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="w-48 min-w-[12rem]">
                                <Label>{STR.purpose}</Label>
                                <Select
                                    value={activePurpose}
                                    onValueChange={(v: string) =>
                                        setActivePurpose(v as EmailPurpose)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PURPOSES.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {friendlyPurpose[p]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Copy from… */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="mt-6">
                                        {STR.copyFrom}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Copy settings from</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {PURPOSES.filter((p) => p !== activePurpose).map((p) => (
                                        <DropdownMenuItem
                                            key={p}
                                            onClick={() => actions.copyFrom(activePurpose, p)}
                                        >
                                            {friendlyPurpose[p]}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="pt-6">
                                <TestBadge outcome={activeProfile._smtpTest} />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" disabled={state.loading || state.saving}>
                                        {STR.testConn}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>SMTP by purpose</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {PURPOSES.map((p) => (
                                        <DropdownMenuItem
                                            key={p}
                                            disabled={!!state.testing || !isSmtpLooksValid(state.profiles[p])}
                                            onClick={() => actions.test("smtp", p)}
                                        >
                                            {friendlyPurpose[p]}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <SendTestDialog
                                disabled={state.loading || !!state.testing}
                                onSend={(purpose, to) => actions.test("send", purpose, to)}
                            />

                            <Button
                                variant="secondary"
                                disabled={state.loading || state.saving}
                                onClick={actions.restoreDefaults}
                            >
                                {STR.restore}
                            </Button>

                            <Button
                                variant="ghost"
                                disabled={!dirty || state.saving}
                                onClick={actions.revert}
                            >
                                {STR.cancel}
                            </Button>
                        </div>
                    </div>

                    {state.testing ? (
                        <Notice
                            title={`${STR.testRunning} ${state.testing.kind.toUpperCase()} for ${friendlyPurpose[state.testing.purpose]
                                }…`}
                        >
                            {STR.testSlow}
                        </Notice>
                    ) : null}

                    {/* Active profile form */}
                    <ProfileForm
                        profile={activeProfile}
                        onChange={(path, value) =>
                            actions.setNested(activePurpose, path, value)
                        }
                        onToggleTLS={(which, checked) =>
                            actions.toggleTLS_SSL(activePurpose, which, checked)
                        }
                        onPreset={(k) => {
                            actions.preset(activePurpose, k);
                            if (k === "ses") {
                                const region = extractSesRegion(
                                    state.profiles[activePurpose].smtp.host
                                );
                                if (!region) {
                                    actions.setNested(
                                        activePurpose,
                                        ["smtp", "host"],
                                        buildSesHost("us-east-1")
                                    );
                                }
                            }
                        }}
                        onTest={(kind) => actions.test(kind, activePurpose)}
                        sesRegion={showSesRegion ? sesRegion || "us-east-1" : undefined}
                        onChangeSesRegion={(r) =>
                            actions.setNested(
                                activePurpose,
                                ["smtp", "host"],
                                buildSesHost(r)
                            )
                        }
                    />

                    {/* DKIM SECTION */}
                    <fieldset className="space-y-4 rounded-xl border p-4">
                        <SectionLegend>{STR.dkimLegend}</SectionLegend>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="dkim-domain">{STR.domain}</Label>
                                <Input
                                    id="dkim-domain"
                                    placeholder="yourdomain.com"
                                    value={state.dkim.domain}
                                    onChange={(e) => actions.setDkim({ domain: e.target.value })}
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Domain that matches the SMTP From address (envelope domain).
                                </p>
                            </div>
                            <div>
                                <Label htmlFor="dkim-selector">{STR.selector}</Label>
                                <Input
                                    id="dkim-selector"
                                    placeholder="default"
                                    value={state.dkim.selector}
                                    onChange={(e) =>
                                        actions.setDkim({ selector: e.target.value })
                                    }
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    DNS TXT record name will be: <code>selector._domainkey.domain</code>
                                </p>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="dkim-public">{STR.publicKey}</Label>
                            <textarea
                                id="dkim-public"
                                className="min-h-28 w-full rounded-md border bg-background p-2 text-sm"
                                placeholder="v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFA..."
                                value={state.dkim.publicKey}
                                onChange={(e) =>
                                    actions.setDkim({ publicKey: e.target.value })
                                }
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                Paste the public key value you publish in DNS (no quotes).
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={actions.checkDns}
                                    disabled={
                                        state.dkim.status === "checking" ||
                                        !state.dkim.domain.trim() ||
                                        !state.dkim.selector.trim()
                                    }
                                >
                                    {state.dkim.status === "checking"
                                        ? STR.checking
                                        : STR.dnsCheck}
                                </Button>
                                <DkimStatusBadge status={state.dkim.status} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {state.dkim.lastCheckedAt
                                    ? `Last checked ${timeAgo(state.dkim.lastCheckedAt)}`
                                    : `Not checked yet`}
                            </div>
                        </div>
                        {state.dkim.lastResult ? (
                            <Notice title="DNS result">
                                <span className="break-words">{state.dkim.lastResult}</span>
                            </Notice>
                        ) : null}
                    </fieldset>

                    {/* Footer info only (no extra buttons) */}
                    <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
                        <div>
                            {dirty ? (
                                <span className="text-yellow-600 dark:text-yellow-500">
                                    {STR.unsaved}
                                </span>
                            ) : (
                                <span>
                                    {STR.lastUpdated} {timeAgo(state.lastUpdated)}
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}

/* ================== DKIM status badge ================== */
function DkimStatusBadge({
    status,
}: {
    status?: "unknown" | "valid" | "invalid" | "checking";
}) {
    if (!status || status === "unknown")
        return <Badge variant="outline">{STR.dkimStatusUnknown}</Badge>;
    if (status === "checking")
        return <Badge variant="outline">{STR.checking}</Badge>;
    if (status === "valid") return <Badge>{STR.dkimStatusValid}</Badge>;
    return <Badge variant="destructive">{STR.dkimStatusInvalid}</Badge>;
}

/* ================== profile form ================== */
function ProfileForm({
    profile,
    onChange,
    onToggleTLS,
    onPreset,
    onTest,
    sesRegion,
    onChangeSesRegion,
}: {
    profile: ProfileState;
    onChange: (path: string[], value: any) => void;
    onToggleTLS: (which: "tls" | "ssl", checked: boolean) => void;
    onPreset: (k: SmtpPresetKey) => void;
    onTest: (kind: TestKind) => void;
    sesRegion?: string;
    onChangeSesRegion?: (region: string) => void;
}) {
    const imapEnabled = !!profile._imapEnabled;
    const popEnabled = !!profile._popEnabled;
    const smtpValid = isSmtpLooksValid(profile);

    const smtpHostError = !profile.smtp.host?.trim()
        ? "SMTP host is required"
        : undefined;
    const smtpPortError =
        !profile.smtp.port ||
            Number(profile.smtp.port) < 1 ||
            Number(profile.smtp.port) > 65535
            ? "SMTP port must be 1–65535"
            : undefined;
    const smtpFromError =
        !profile.smtp.fromAddress || !isEmail(profile.smtp.fromAddress)
            ? "From address must be a valid email"
            : undefined;
    const smtpMutualError =
        profile.smtp.useSSL && profile.smtp.useTLS
            ? "TLS and SSL are mutually exclusive"
            : undefined;

    return (
        <div className="space-y-6">
            {!profile.enabled && (
                <Notice title={STR.disabledBannerTitle}>
                    {STR.disabledBannerDesc}
                </Notice>
            )}

            <fieldset className="space-y-4 rounded-xl border p-4">
                <SectionLegend>{STR.smtpLegend}</SectionLegend>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="w-48">
                        <Label>{STR.preset}</Label>
                        <Select onValueChange={(v) => onPreset(v as SmtpPresetKey)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose provider" />
                            </SelectTrigger>
                            <SelectContent>
                                {SMTP_PRESETS.map((p) => (
                                    <SelectItem key={p.key} value={p.key}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {sesRegion && onChangeSesRegion && (
                        <div className="w-48">
                            <Label>{STR.sesRegion}</Label>
                            <Select value={sesRegion} onValueChange={(v) => onChangeSesRegion(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SES_REGION_OPTIONS.map((r) => (
                                        <SelectItem key={r} value={r}>
                                            {r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex-1 min-w-[200px]">
                        <Label htmlFor="smtp-host">{STR.host}</Label>
                        <Input
                            id="smtp-host"
                            value={profile.smtp.host}
                            onChange={(e) => onChange(["smtp", "host"], e.target.value)}
                            placeholder="smtp.example.com"
                        />
                        <FieldError message={smtpHostError} />
                    </div>
                    <div className="w-28">
                        <Label htmlFor="smtp-port">{STR.port}</Label>
                        <Input
                            id="smtp-port"
                            type="number"
                            min={1}
                            max={65535}
                            value={String(profile.smtp.port)}
                            onChange={(e) =>
                                onChange(["smtp", "port"], numberOrEmpty(e.target.valueAsNumber))
                            }
                        />
                        <FieldError message={smtpPortError} />
                    </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                    <div>
                        <Label htmlFor="smtp-username">{STR.username}</Label>
                        <Input
                            id="smtp-username"
                            value={profile.smtp.username}
                            onChange={(e) => onChange(["smtp", "username"], e.target.value)}
                            placeholder="user@example.com or apikey"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Provider may require app password or API key.
                        </p>
                    </div>

                    <PasswordField
                        id="smtp-password"
                        label={STR.password}
                        edited={!!profile._passwordEdited}
                        onChange={(v) => onChange(["smtp", "password"], v)}
                        onEdited={(f) => onChange(["_passwordEdited"], f)}
                    />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                    <div>
                        <Label htmlFor="smtp-from">{STR.from}</Label>
                        <Input
                            id="smtp-from"
                            type="email"
                            value={profile.smtp.fromAddress}
                            onChange={(e) => onChange(["smtp", "fromAddress"], e.target.value)}
                            placeholder="noreply@yourdomain.com"
                        />
                        <FieldError message={smtpFromError} />
                    </div>
                    <div className="flex items-end gap-6 pt-6">
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={profile.smtp.useTLS}
                                onCheckedChange={(v) => onToggleTLS("tls", !!v)}
                            />
                            <span className="text-sm">{STR.tls}</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={profile.smtp.useSSL}
                                onCheckedChange={(v) => onToggleTLS("ssl", !!v)}
                            />
                            <span className="text-sm">{STR.ssl}</span>
                        </label>
                        <Button
                            disabled={!smtpValid}
                            variant="outline"
                            size="sm"
                            onClick={() => onTest("smtp")}
                        >
                            Test SMTP
                        </Button>
                        <TestBadge outcome={profile._smtpTest} />
                    </div>
                    <div className="md:col-span-2">
                        <FieldError message={smtpMutualError} />
                    </div>
                </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-xl border p-4">
                <SectionLegend>{STR.imapLegend}</SectionLegend>
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        {STR.imapEnableCopy}
                    </div>
                    <Switch
                        checked={imapEnabled}
                        onCheckedChange={(v) => {
                            onChange(["_imapEnabled"], !!v);
                            if (v) onChange(["_popEnabled"], false);
                        }}
                        aria-label="Enable IMAP"
                    />
                </div>
                <div
                    className={cn("grid gap-2 md:grid-cols-2", !imapEnabled && "opacity-60")}
                    aria-disabled={!imapEnabled}
                    aria-describedby="imap-disabled-hint"
                >
                    <div>
                        <Label htmlFor="imap-host">{STR.host}</Label>
                        <Input
                            id="imap-host"
                            value={profile.imap.host}
                            onChange={(e) => {
                                onChange(["imap", "host"], e.target.value);
                                onChange(["_imapEnabled"], true);
                            }}
                            placeholder="imap.example.com"
                        />
                    </div>
                    <div>
                        <Label htmlFor="imap-port">{STR.port}</Label>
                        <Input
                            id="imap-port"
                            type="number"
                            min={1}
                            max={65535}
                            value={String(profile.imap.port)}
                            onChange={(e) => {
                                onChange(["imap", "port"], numberOrEmpty(e.target.valueAsNumber));
                                onChange(["_imapEnabled"], true);
                            }}
                        />
                    </div>
                    <div>
                        <Label htmlFor="imap-username">{STR.username}</Label>
                        <Input
                            id="imap-username"
                            value={profile.imap.username}
                            onChange={(e) => {
                                onChange(["imap", "username"], e.target.value);
                                onChange(["_imapEnabled"], true);
                            }}
                        />
                    </div>
                    <PasswordField
                        id="imap-password"
                        label={STR.password}
                        edited={!!profile._imapPwdEdited}
                        onChange={(v) => {
                            onChange(["imap", "password"], v);
                            onChange(["_imapEnabled"], true);
                        }}
                        onEdited={(f) => onChange(["_imapPwdEdited"], f)}
                    />
                    <div className="flex items-end gap-6 pt-2">
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={profile.imap.useSSL}
                                onCheckedChange={(v) => onChange(["imap", "useSSL"], !!v)}
                            />
                            <span className="text-sm">{STR.sslShort}</span>
                        </label>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!imapLooksValid(profile)}
                            onClick={() => onTest("imap")}
                        >
                            Test IMAP
                        </Button>
                        <TestBadge outcome={profile._imapTest} />
                    </div>
                </div>
                {!imapEnabled && (
                    <p id="imap-disabled-hint" className="text-xs text-muted-foreground">
                        {STR.imapHint}
                    </p>
                )}
            </fieldset>

            <fieldset className="space-y-4 rounded-xl border p-4">
                <SectionLegend>{STR.popLegend}</SectionLegend>
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">{STR.popEnableCopy}</div>
                    <Switch
                        checked={popEnabled}
                        onCheckedChange={(v) => {
                            onChange(["_popEnabled"], !!v);
                            if (v) onChange(["_imapEnabled"], false);
                        }}
                        aria-label="Enable POP"
                    />
                </div>
                <div
                    className={cn("grid gap-2 md:grid-cols-2", !popEnabled && "opacity-60")}
                    aria-disabled={!popEnabled}
                    aria-describedby="pop-disabled-hint"
                >
                    <div>
                        <Label htmlFor="pop-host">{STR.host}</Label>
                        <Input
                            id="pop-host"
                            value={profile.pop.host}
                            onChange={(e) => {
                                onChange(["pop", "host"], e.target.value);
                                onChange(["_popEnabled"], true);
                            }}
                            placeholder="pop.example.com"
                        />
                    </div>
                    <div>
                        <Label htmlFor="pop-port">{STR.port}</Label>
                        <Input
                            id="pop-port"
                            type="number"
                            min={1}
                            max={65535}
                            value={String(profile.pop.port)}
                            onChange={(e) => {
                                onChange(["pop", "port"], numberOrEmpty(e.target.valueAsNumber));
                                onChange(["_popEnabled"], true);
                            }}
                        />
                    </div>
                    <div>
                        <Label htmlFor="pop-username">{STR.username}</Label>
                        <Input
                            id="pop-username"
                            value={profile.pop.username}
                            onChange={(e) => {
                                onChange(["pop", "username"], e.target.value);
                                onChange(["_popEnabled"], true);
                            }}
                        />
                    </div>
                    <PasswordField
                        id="pop-password"
                        label={STR.password}
                        edited={!!profile._popPwdEdited}
                        onChange={(v) => {
                            onChange(["pop", "password"], v);
                            onChange(["_popEnabled"], true);
                        }}
                        onEdited={(f) => onChange(["_popPwdEdited"], f)}
                    />
                    <div className="flex items-end gap-6 pt-2">
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={profile.pop.useSSL}
                                onCheckedChange={(v) => onChange(["pop", "useSSL"], !!v)}
                            />
                            <span className="text-sm">{STR.sslShort}</span>
                        </label>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!popLooksValid(profile)}
                            onClick={() => onTest("pop")}
                        >
                            Test POP
                        </Button>
                        <TestBadge outcome={profile._popTest} />
                    </div>
                </div>
                {!popEnabled && (
                    <p id="pop-disabled-hint" className="text-xs text-muted-foreground">
                        {STR.popHint}
                    </p>
                )}
            </fieldset>

            <fieldset className="space-y-2 rounded-xl border p-4">
                <SectionLegend>{STR.statusLegend}</SectionLegend>
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                        <Switch
                            checked={profile.enabled}
                            onCheckedChange={(v) => onChange(["enabled"], !!v)}
                        />
                        <span className="text-sm">{STR.enabled}</span>
                    </label>
                    <div className="text-xs text-muted-foreground">
                        If disabled, this purpose will queue messages but not send.
                    </div>
                </div>
            </fieldset>
        </div>
    );
}

/* ================== send test dialog ================== */
function SendTestDialog({
    disabled,
    onSend,
}: {
    disabled?: boolean;
    onSend: (purpose: EmailPurpose, to: string, subject?: string, body?: string) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [purpose, setPurpose] = React.useState<EmailPurpose>("alerts");
    const [to, setTo] = React.useState("");
    const [subject, setSubject] = React.useState(STR.testSubject);
    const [body, setBody] = React.useState(STR.testBody);
    const valid = isEmail(to);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" disabled={disabled}>
                    {STR.sendTest}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{STR.sendTestTitle}</DialogTitle>
                    <DialogDescription>{STR.sendTestDesc}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div>
                        <Label>{STR.profile}</Label>
                        <Select
                            value={purpose}
                            onValueChange={(v: string) => setPurpose(v as EmailPurpose)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PURPOSES.map((p) => (
                                    <SelectItem key={p} value={p}>
                                        {friendlyPurpose[p]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="to">{STR.to}</Label>
                        <Input
                            id="to"
                            type="email"
                            placeholder="you@example.com"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="subject">{STR.subject}</Label>
                        <Input
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="body">{STR.body}</Label>
                        <textarea
                            id="body"
                            className="min-h-28 w-full rounded-md border bg-background p-2 text-sm"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        {STR.cancel}
                    </Button>
                    <Button
                        disabled={!valid}
                        onClick={() => {
                            onSend(purpose, to, subject, body);
                            setOpen(false);
                        }}
                    >
                        Send
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
