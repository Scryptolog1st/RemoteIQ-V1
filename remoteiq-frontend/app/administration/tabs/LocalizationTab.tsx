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
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useBranding } from "@/app/providers/BrandingProvider";
import { ToastFn } from "../types";

// API types + calls (aliased to avoid name collisions)
import {
    getLocalizationSettings,
    saveLocalizationSettings,
    type LocalizationSettings as ApiLocalizationSettings,
} from "@/lib/api";

/** UI types (distinct from API types) */
type TimeFormat = "12h" | "24h";
type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
type NumberFormat = "1,234.56" | "1.234,56";
type FirstDay = "sunday" | "monday";

type UILocalization = {
    language: string;
    dateFormat: DateFormat;
    timeFormat: TimeFormat;
    numberFormat: NumberFormat;
    timeZone: string;
    firstDayOfWeek: FirstDay;
};

interface LocalizationTabProps {
    push: ToastFn;
}

/* ------------------- Options ------------------- */

const LANG_OPTIONS = [
    { value: "en-US", label: "English (United States)" },
    { value: "en-GB", label: "English (United Kingdom)" },
    { value: "es-ES", label: "Español (España)" },
    { value: "fr-FR", label: "Français (France)" },
    { value: "de-DE", label: "Deutsch (Deutschland)" },
    { value: "it-IT", label: "Italiano (Italia)" },
    { value: "pt-BR", label: "Português (Brasil)" },
    { value: "ja-JP", label: "日本語 (日本)" },
    { value: "zh-CN", label: "中文 (简体, 中国)" },
    { value: "ar-SA", label: "العربية (السعودية)" },
];

const TZ_OPTIONS = [
    { value: "UTC", label: "UTC" },
    { value: "America/New_York", label: "Eastern Time (US & Canada)" },
    { value: "America/Chicago", label: "Central Time (US & Canada)" },
    { value: "America/Denver", label: "Mountain Time (US & Canada)" },
    { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris (CET/CEST)" },
    { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "Shanghai (CST)" },
    { value: "Asia/Kolkata", label: "Kolkata (IST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

const DATE_FORMATS: readonly DateFormat[] = [
    "MM/DD/YYYY",
    "DD/MM/YYYY",
    "YYYY-MM-DD",
];

const TIME_FORMATS: readonly TimeFormat[] = ["12h", "24h"];

const NUMBER_FORMATS: readonly NumberFormat[] = ["1,234.56", "1.234,56"];

const FIRST_DAY_OPTIONS: readonly FirstDay[] = ["sunday", "monday"];

/* ------------------- Helpers ------------------- */

function getHour12(tf: TimeFormat) {
    return tf === "12h";
}
function getSeparators(numberFormat: NumberFormat) {
    return numberFormat === "1.234,56"
        ? { thousands: ".", decimal: "," }
        : { thousands: ",", decimal: "." };
}
function formatWithPattern(
    d: Date,
    pattern: DateFormat,
    locale: string,
    timeZone: string
) {
    const y = new Intl.DateTimeFormat(locale, { year: "numeric", timeZone }).format(d);
    const m = new Intl.DateTimeFormat(locale, { month: "2-digit", timeZone }).format(d);
    const day = new Intl.DateTimeFormat(locale, { day: "2-digit", timeZone }).format(d);
    switch (pattern) {
        case "YYYY-MM-DD":
            return `${y}-${m}-${day}`;
        case "DD/MM/YYYY":
            return `${day}/${m}/${y}`;
        default:
            return `${m}/${day}/${y}`;
    }
}
function formatTime(d: Date, locale: string, timeZone: string, tf: TimeFormat) {
    return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: getHour12(tf),
        timeZone,
    }).format(d);
}
function sampleNumber(n: number, nf: NumberFormat) {
    const localeForStyle = nf === "1.234,56" ? "de-DE" : "en-US";
    return new Intl.NumberFormat(localeForStyle, { maximumFractionDigits: 2 }).format(n);
}
function sampleCurrency(n: number, currency: string, nf: NumberFormat) {
    const localeForStyle = nf === "1.234,56" ? "de-DE" : "en-US";
    return new Intl.NumberFormat(localeForStyle, {
        style: "currency",
        currency,
        currencyDisplay: "symbol",
        maximumFractionDigits: 2,
    }).format(n);
}

// Narrowers
function asTimeFormat(v: string): TimeFormat {
    return v === "12h" ? "12h" : "24h";
}
function asDateFormat(v: string): DateFormat {
    return DATE_FORMATS.includes(v as DateFormat) ? (v as DateFormat) : "MM/DD/YYYY";
}
function asNumberFormat(v: string): NumberFormat {
    return NUMBER_FORMATS.includes(v as NumberFormat) ? (v as NumberFormat) : "1,234.56";
}
function asFirstDay(v: string): FirstDay {
    return v === "monday" ? "monday" : "sunday";
}

export default function LocalizationTab({ push }: LocalizationTabProps) {
    const { branding } = useBranding();
    const primary = branding?.primaryColor || "#0f172a";
    const secondary = branding?.secondaryColor || "#e5e7eb";

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    const [localization, setLocalization] = React.useState<UILocalization>({
        language: "en-US",
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
        numberFormat: "1,234.56",
        timeZone: "America/New_York",
        firstDayOfWeek: "sunday",
    });

    // Extra, purely for preview:
    const [currency, setCurrency] = React.useState<string>("USD");
    const [sampleValue, setSampleValue] = React.useState<string>("1234.56");
    const [sampleDate, setSampleDate] = React.useState<Date>(new Date());

    // Load from API
    React.useEffect(() => {
        (async () => {
            try {
                const s = await getLocalizationSettings(); // ApiLocalizationSettings
                const ui: UILocalization = {
                    language: s.language || "en-US",
                    dateFormat: asDateFormat(s.dateFormat || "MM/DD/YYYY"),
                    // IMPORTANT: API returns "12h" | "24h" — use it directly
                    timeFormat: asTimeFormat((s.timeFormat as any) || "12h"),
                    numberFormat: asNumberFormat(s.numberFormat || "1,234.56"),
                    timeZone: s.timeZone || "UTC",
                    firstDayOfWeek: asFirstDay(s.firstDayOfWeek || "sunday"),
                };
                setLocalization(ui);
                if ((s as any).currency) setCurrency((s as any).currency);
            } catch (e: any) {
                push({
                    title: "Failed to load localization",
                    desc: e?.message,
                    kind: "destructive",
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [push]);

    // Apply browser defaults
    const applyBrowserDefaults = () => {
        const lang =
            typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
        let tz = "UTC";
        try {
            tz = (Intl.DateTimeFormat().resolvedOptions().timeZone as string) || "UTC";
        } catch { }
        setLocalization((prev) => ({
            ...prev,
            language: LANG_OPTIONS.some((l) => l.value === lang) ? lang : prev.language,
            timeZone: TZ_OPTIONS.some((t) => t.value === tz) ? tz : prev.timeZone,
        }));
        push({ title: "Applied browser defaults", kind: "success" });
    };

    // Derived previews
    const locale = localization.language;
    const tz = localization.timeZone;
    const tf = localization.timeFormat;
    const df = localization.dateFormat;
    const nf = localization.numberFormat;
    const { thousands, decimal } = getSeparators(nf);

    const parsedSample = React.useMemo(() => {
        const normalized = sampleValue.replaceAll(thousands, "").replace(decimal, ".");
        const num = Number(normalized);
        return isNaN(num) ? 1234.56 : num;
    }, [sampleValue, thousands, decimal]);

    const now = sampleDate;
    const datePreview = formatWithPattern(now, df, locale, tz);
    const timePreview = formatTime(now, locale, tz, tf);
    const numberPreview = sampleNumber(parsedSample, nf);
    const currencyPreview = sampleCurrency(parsedSample, currency, nf);

    async function save() {
        setSaving(true);
        try {
            // Map UI -> API shape (timeFormat stays "12h" | "24h")
            const payload: ApiLocalizationSettings = {
                language: localization.language,
                dateFormat: localization.dateFormat,
                timeFormat: localization.timeFormat,
                numberFormat: localization.numberFormat,
                timeZone: localization.timeZone,
                firstDayOfWeek: localization.firstDayOfWeek,
                currency, // optional
            };
            await saveLocalizationSettings(payload);
            push({ title: "Localization settings saved", kind: "success" });
        } catch (e: any) {
            push({ title: "Save failed", desc: e?.message, kind: "destructive" });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return null;

    return (
        <TabsContent value="localization" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Localization & Regional Settings</CardTitle>
                    <CardDescription>
                        These settings control language, time zone, and formatting across your app. The
                        preview uses your current brand colors and logos.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Top actions */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Tip: “Use browser defaults” sets Language and Time Zone from your current
                            browser.
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={applyBrowserDefaults}
                                style={{ borderColor: primary, color: primary }}
                            >
                                Use browser defaults
                            </Button>
                            <Button
                                variant="success"
                                onClick={save}
                                disabled={saving}
                                style={{ background: primary, color: "#fff", borderColor: primary }}
                            >
                                {saving ? "Saving…" : "Save Localization"}
                            </Button>
                        </div>
                    </div>

                    {/* Form grid */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="grid gap-1">
                            <Label className="text-sm">Default Language</Label>
                            <Select
                                value={localization.language}
                                onValueChange={(v: string) =>
                                    setLocalization((l) => ({ ...l, language: v }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANG_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-sm">Time Zone</Label>
                            <Select
                                value={localization.timeZone}
                                onValueChange={(v: string) =>
                                    setLocalization((l) => ({ ...l, timeZone: v }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a time zone" />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {TZ_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-sm">First Day of Week</Label>
                            <Select
                                value={localization.firstDayOfWeek}
                                onValueChange={(v: string) =>
                                    setLocalization((l) => ({
                                        ...l,
                                        firstDayOfWeek: asFirstDay(v),
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FIRST_DAY_OPTIONS.map((d) => (
                                        <SelectItem key={d} value={d}>
                                            {d === "monday" ? "Monday" : "Sunday"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-sm">Date Format</Label>
                            <Select
                                value={localization.dateFormat}
                                onValueChange={(v: string) =>
                                    setLocalization((l) => ({
                                        ...l,
                                        dateFormat: asDateFormat(v),
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DATE_FORMATS.map((fmt) => (
                                        <SelectItem key={fmt} value={fmt}>
                                            {fmt}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-sm">Time Format</Label>
                            <Select
                                value={localization.timeFormat}
                                onValueChange={(v: string) =>
                                    setLocalization((l) => ({
                                        ...l,
                                        timeFormat: asTimeFormat(v),
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIME_FORMATS.map((fmt) => (
                                        <SelectItem key={fmt} value={fmt}>
                                            {fmt === "12h" ? "12-hour" : "24-hour"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-sm">Number Format</Label>
                            <Select
                                value={localization.numberFormat}
                                onValueChange={(v: string) =>
                                    setLocalization((l) => ({
                                        ...l,
                                        numberFormat: asNumberFormat(v),
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {NUMBER_FORMATS.map((fmt) => (
                                        <SelectItem key={fmt} value={fmt}>
                                            {fmt}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Preview & Samples */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Samples */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Samples</CardTitle>
                                <CardDescription>
                                    Change the inputs to see live formatting.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-1">
                                    <Label className="text-sm">Sample Value</Label>
                                    <Input
                                        value={sampleValue}
                                        onChange={(e) => setSampleValue(e.target.value)}
                                        placeholder={
                                            localization.numberFormat === "1.234,56" ? "1.234,56" : "1,234.56"
                                        }
                                    />
                                </div>

                                <div className="grid gap-1">
                                    <Label className="text-sm">Sample Date/Time</Label>
                                    <Input
                                        type="datetime-local"
                                        value={new Date(
                                            sampleDate.getTime() - sampleDate.getTimezoneOffset() * 60000
                                        )
                                            .toISOString()
                                            .slice(0, 16)}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setSampleDate(v ? new Date(v) : new Date());
                                        }}
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        The preview converts to your selected time zone and formats.
                                    </div>
                                </div>

                                <div className="grid gap-1">
                                    <Label className="text-sm">Preview Currency</Label>
                                    <Select value={currency} onValueChange={setCurrency}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="EUR">EUR</SelectItem>
                                            <SelectItem value="GBP">GBP</SelectItem>
                                            <SelectItem value="JPY">JPY</SelectItem>
                                            <SelectItem value="BRL">BRL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Live Preview */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Live Preview</CardTitle>
                                <CardDescription>Formatted output using your brand styles.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="text-xs text-muted-foreground">Language</div>
                                    <div className="text-sm">{localization.language}</div>

                                    <div className="text-xs text-muted-foreground">Time Zone</div>
                                    <div className="text-sm">{localization.timeZone}</div>

                                    <div className="text-xs text-muted-foreground">First Day of Week</div>
                                    <div className="text-sm capitalize">{localization.firstDayOfWeek}</div>

                                    <div className="text-xs text-muted-foreground">Date Format</div>
                                    <div className="text-sm">{localization.dateFormat}</div>

                                    <div className="text-xs text-muted-foreground">Time Format</div>
                                    <div className="text-sm">{localization.timeFormat}</div>

                                    <div className="text-xs text-muted-foreground">Number Format</div>
                                    <div className="text-sm">{localization.numberFormat}</div>
                                </div>

                                <div className="h-px my-2" style={{ background: secondary }} />

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="text-xs text-muted-foreground">Date</div>
                                    <div className="text-sm font-medium">{datePreview}</div>

                                    <div className="text-xs text-muted-foreground">Time</div>
                                    <div className="text-sm font-medium">{timePreview}</div>

                                    <div className="text-xs text-muted-foreground">Number</div>
                                    <div className="text-sm font-medium">{numberPreview}</div>

                                    <div className="text-xs text-muted-foreground">Currency</div>
                                    <div className="text-sm font-medium">{currencyPreview}</div>
                                </div>

                                <div className="h-px my-2" style={{ background: secondary }} />

                                {/* Calendar header demo */}
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Calendar Header</div>
                                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                                        {(localization.firstDayOfWeek === "monday"
                                            ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                                            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                                        ).map((d) => (
                                            <div
                                                key={d}
                                                className="rounded border px-2 py-1"
                                                style={{
                                                    background: `${secondary}80`,
                                                    borderColor: secondary,
                                                }}
                                            >
                                                {d}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
