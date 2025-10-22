"use client";

/**
 * Branding & Appearance
 * -----------------------------------------------------------------------------
 * Two fixed columns with neatly aligned rows of paired cards:
 *
 * Row 1:  Colors                             |  Header Preview (no top bar)
 * Row 2:  Logos                               |  Logos Preview (side-by-side)
 * Row 3:  Login Background                    |  Login Page Preview
 * Row 4:  Favicon (.ico)                      |  Favicon Preview
 * Row 5:  Email Header HTML                   |  Email Footer HTML
 * Row 6:  Custom CSS  (spans both columns)
 *
 * Each pair is rendered in a "PairRow" grid with items stretch + Cards set to
 * h-full so both sides align to equal heights. On small screens everything
 * stacks naturally; on md+ screens you get perfect 2-column alignment.
 */

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
import { TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
    Palette,
    Image as ImageIcon,
    Star as FaviconIcon,
    Pipette,
    Info as InfoIcon,
    MonitorSmartphone,
    ImagePlus,
} from "lucide-react";
import { LabeledTextarea, CheckToggle } from "../helpers";
import { ToastFn } from "../types";
import { useBranding } from "@/app/providers/BrandingProvider";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/* =============================================================================
 * Types / Props
 * ========================================================================== */
interface BrandingTabProps {
    push: ToastFn;
}

/* =============================================================================
 * Helpers: color conversions
 * ========================================================================== */
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = "image/*";
const ACCEPTED_FAVICON_TYPES = ".ico,image/x-icon";

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    if (!HEX.test(hex)) return null;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const num = parseInt(h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
    const toHex = (v: number) => v.toString(16).padStart(2, "0");
    return `#${toHex(clamp(Math.round(r), 0, 255))}${toHex(
        clamp(Math.round(g), 0, 255)
    )}${toHex(clamp(Math.round(b), 0, 255))}`;
}
function rgbToHsl(r: number, g: number, b: number) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let h = 0,
        s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case r:
                h = ((g - b) / d) % 6;
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            default:
                h = (r - g) / d + 4;
        }
        h = Math.round(h * 60);
        if (h < 0) h += 360;
    }
    return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}
function hslToRgb(h: number, s: number, l: number) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0,
        g1 = 0,
        b1 = 0;
    if (0 <= h && h < 60) [r1, g1, b1] = [c, x, 0];
    else if (60 <= h && h < 120) [r1, g1, b1] = [x, c, 0];
    else if (120 <= h && h < 180) [r1, g1, b1] = [0, c, x];
    else if (180 <= h && h < 240) [r1, g1, b1] = [0, x, c];
    else if (240 <= h && h < 300) [r1, g1, b1] = [x, 0, c];
    else[r1, g1, b1] = [c, 0, x];
    const r = (r1 + m) * 255,
        g = (g1 + m) * 255,
        b = (b1 + m) * 255;
    return { r, g, b };
}
function hexToHsl(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return { h: 0, s: 0, l: 0 };
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
}
function hslToHex(h: number, s: number, l: number) {
    const { r, g, b } = hslToRgb(h, s, l);
    return rgbToHex(r, g, b);
}

/* =============================================================================
 * EyeDropper typings
 * ========================================================================== */
interface NativeEyeDropper {
    open: () => Promise<{ sRGBHex: string }>;
}
declare global {
    interface Window {
        EyeDropper?: new () => NativeEyeDropper;
    }
}

/* =============================================================================
 * PairRow – 2 equal-height columns per row
 * ========================================================================== */
function PairRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid md:grid-cols-2 gap-6 items-stretch">{children}</div>
    );
}

/* =============================================================================
 * ColorPicker (modal with screen eyedropper)
 * ========================================================================== */
function ColorPicker({
    label,
    value,
    onChange,
    error,
    className,
    triggerClassName,
}: {
    label: string;
    value: string;
    onChange: (hex: string) => void;
    error?: string;
    className?: string;
    triggerClassName?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [hex, setHex] = React.useState<string>(value || "#000000");
    const [{ h, s, l }, setHsl] = React.useState(() => hexToHsl(value || "#000000"));
    const PRESETS = React.useMemo(
        () => [
            "#3b82f6",
            "#22c55e",
            "#ef4444",
            "#a855f7",
            "#06b6d4",
            "#f59e0b",
            "#111827",
            "#4b5563",
            "#9ca3af",
            "#ffffff",
        ],
        []
    );

    // Always-mounted fallback color input (for non-supporting browsers)
    const colorFallbackRef = React.useRef<HTMLInputElement | null>(null);
    const reopenTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        if (open) {
            const safeHex = HEX.test(value) ? value : "#000000";
            setHex(safeHex);
            setHsl(hexToHsl(safeHex));
        }
        return () => {
            if (reopenTimerRef.current) {
                clearTimeout(reopenTimerRef.current);
                reopenTimerRef.current = null;
            }
        };
    }, [open, value]);

    const onHexChange = (v: string) => {
        setHex(v);
        if (HEX.test(v)) setHsl(hexToHsl(v));
    };

    // NEW: keep HEX in sync while dragging sliders
    const setHslAndHex = (next: Partial<{ h: number; s: number; l: number }>) => {
        const nh = clamp(next.h ?? h, 0, 360);
        const ns = clamp(next.s ?? s, 0, 100);
        const nl = clamp(next.l ?? l, 0, 100);
        setHsl({ h: nh, s: ns, l: nl });
        setHex(hslToHex(nh, ns, nl));
    };

    const apply = () => {
        if (!HEX.test(hex)) return;
        onChange(hex);
        setOpen(false);
    };

    const hueGradient =
        "linear-gradient(90deg, red, #ff0, #0f0, #0ff, #00f, #f0f, red)";
    const satGradient = `linear-gradient(90deg, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))`;
    const lightGradient = `linear-gradient(90deg, hsl(${h} ${s}% 0%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 100%))`;

    const pickFromScreen = async () => {
        const hasEyeDropper =
            typeof window !== "undefined" && !!window.EyeDropper;

        // Close the modal so users can click elements behind it
        setOpen(false);
        await new Promise((r) => setTimeout(r, 120));

        if (hasEyeDropper) {
            try {
                const eye = new window.EyeDropper!();
                const result = await eye.open();
                const picked = (result?.sRGBHex || "").toLowerCase();
                if (HEX.test(picked)) {
                    setHex(picked);
                    setHsl(hexToHsl(picked));
                    onChange(picked);
                }
            } catch {
                // user canceled -> ignore
            } finally {
                setOpen(true);
            }
        } else {
            const input = colorFallbackRef.current;
            if (!input) {
                setOpen(true);
                return;
            }

            const cleanupAndReopen = () => {
                input.removeEventListener("change", handleChange);
                window.removeEventListener("focus", reopenGuard, true);
                if (reopenTimerRef.current) {
                    clearTimeout(reopenTimerRef.current);
                    reopenTimerRef.current = null;
                }
                setOpen(true);
            };

            const handleChange = (e: Event) => {
                const target = e.target as HTMLInputElement;
                const val = (target?.value || "").toLowerCase();
                if (HEX.test(val)) {
                    setHex(val);
                    setHsl(hexToHsl(val));
                    onChange(val);
                }
                cleanupAndReopen();
            };
            const reopenGuard = () => cleanupAndReopen();

            input.addEventListener("change", handleChange, { once: true });
            window.addEventListener("focus", reopenGuard, { once: true, capture: true });
            reopenTimerRef.current = setTimeout(() => cleanupAndReopen(), 2500);
            input.click();
        }
    };

    return (
        <div className={cn("grid gap-1", className)}>
            {/* Hidden fallback color input */}
            <input
                ref={colorFallbackRef}
                type="color"
                value={HEX.test(hex) ? hex : "#000000"}
                onChange={(e) => onHexChange(e.target.value)}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
            />

            <span className="text-sm">{label}</span>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn("justify-start gap-3 h-9 font-mono text-xs", triggerClassName)}
                        type="button"
                        aria-label={`${label}: ${value || "Select color"}`}
                    >
                        <span
                            className="h-5 w-5 rounded border"
                            style={{ background: HEX.test(value) ? value : "#ffffff" }}
                        />
                        {value || "Select…"}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>{label}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-5">
                        {/* Preview + Eyedropper */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-md border" style={{ background: hex }} />
                                <div className="text-xs text-muted-foreground">
                                    <div>
                                        HEX: <span className="font-mono">{hex}</span>
                                    </div>
                                    <div>
                                        HSL:{" "}
                                        <span className="font-mono">
                                            {h}°, {s}%, {l}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button type="button" variant="secondary" onClick={pickFromScreen}>
                                <Pipette className="h-4 w-4 mr-1" />
                                Pick from screen
                            </Button>
                        </div>

                        {/* Hue */}
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Hue ({h}°)</label>
                            <div className="rounded h-2" style={{ background: hueGradient }} />
                            <Slider
                                value={[h]}
                                max={360}
                                step={1}
                                onValueChange={(v: number[]) => setHslAndHex({ h: v[0] })}
                                aria-label="Hue"
                            />
                        </div>

                        {/* Saturation */}
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Saturation ({s}%)</label>
                            <div className="rounded h-2" style={{ background: satGradient }} />
                            <Slider
                                value={[s]}
                                max={100}
                                step={1}
                                onValueChange={(v: number[]) => setHslAndHex({ s: v[0] })}
                                aria-label="Saturation"
                            />
                        </div>

                        {/* Lightness */}
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Lightness ({l}%)</label>
                            <div className="rounded h-2" style={{ background: lightGradient }} />
                            <Slider
                                value={[l]}
                                max={100}
                                step={1}
                                onValueChange={(v: number[]) => setHslAndHex({ l: v[0] })}
                                aria-label="Lightness"
                            />
                        </div>

                        {/* Hex input */}
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Hex</label>
                            <Input
                                value={hex}
                                onChange={(e) => onHexChange(e.target.value)}
                                placeholder="#3b82f6"
                                className={!HEX.test(hex) ? "border-red-500" : undefined}
                                aria-invalid={!HEX.test(hex)}
                            />
                            {!HEX.test(hex) && (
                                <p className="text-xs text-red-600">Use a valid hex (e.g. #3b82f6 or #fff)</p>
                            )}
                        </div>

                        {/* Presets */}
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Presets</label>
                            <div className="grid grid-cols-10 gap-2">
                                {PRESETS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => {
                                            setHex(c);
                                            setHsl(hexToHsl(c));
                                        }}
                                        className={cn(
                                            "h-7 w-7 rounded border",
                                            hex.toLowerCase() === c ? "ring-2 ring-offset-2 ring-primary" : ""
                                        )}
                                        style={{ background: c }}
                                        aria-label={`Preset ${c}`}
                                        type="button"
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={() => setOpen(false)} type="button">
                                Cancel
                            </Button>
                            <Button onClick={apply} disabled={!HEX.test(hex)} type="button">
                                Apply
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}

/* =============================================================================
 * Main Component
 * ========================================================================== */
export default function BrandingTab({ push }: BrandingTabProps) {
    const { branding, isLoaded, applyPreview, clearPreview, refetch } = useBranding();

    // Form state mirrors server payload
    const [primaryColor, setPrimaryColor] = React.useState("#09090b");
    const [secondaryColor, setSecondaryColor] = React.useState("#fafafa");
    const [logoLightUrl, setLogoLightUrl] = React.useState("");
    const [logoDarkUrl, setLogoDarkUrl] = React.useState("");
    const [loginBackgroundUrl, setLoginBackgroundUrl] = React.useState("");
    const [faviconUrl, setFaviconUrl] = React.useState("");
    const [emailHeader, setEmailHeader] = React.useState("<h1>{{org_name}}</h1>");
    const [emailFooter, setEmailFooter] = React.useState(
        "<p>Copyright 2025. All rights reserved.</p>"
    );
    const [customCss, setCustomCss] = React.useState("/* Your custom CSS here */");
    const [allowClientThemeToggle, setAllowClientThemeToggle] =
        React.useState(true);

    const [errors, setErrors] = React.useState<{ primary?: string; secondary?: string }>(
        {}
    );
    const [uploadingLight, setUploadingLight] = React.useState(false);
    const [uploadingDark, setUploadingDark] = React.useState(false);
    const [uploadingLoginBg, setUploadingLoginBg] = React.useState(false);
    const [uploadingFavicon, setUploadingFavicon] = React.useState(false);

    const lightInputRef = React.useRef<HTMLInputElement | null>(null);
    const darkInputRef = React.useRef<HTMLInputElement | null>(null);
    const loginBgInputRef = React.useRef<HTMLInputElement | null>(null);
    const faviconInputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        if (!isLoaded) return;
        setPrimaryColor(branding?.primaryColor ?? "#09090b");
        setSecondaryColor(branding?.secondaryColor ?? "#fafafa");
        setLogoLightUrl(branding?.logoLightUrl ?? "");
        setLogoDarkUrl(branding?.logoDarkUrl ?? "");
        setLoginBackgroundUrl(branding?.loginBackgroundUrl ?? "");
        setFaviconUrl(branding?.faviconUrl ?? "");
        setEmailHeader(branding?.emailHeader ?? "<h1>{{org_name}}</h1>");
        setEmailFooter(
            branding?.emailFooter ?? "<p>Copyright 2025. All rights reserved.</p>"
        );
        setCustomCss(branding?.customCss ?? "/* Your custom CSS here */");
        setAllowClientThemeToggle(branding?.allowClientThemeToggle ?? true);
    }, [isLoaded, branding]);

    // Live color preview
    React.useEffect(() => {
        applyPreview({ primaryColor, secondaryColor });
    }, [primaryColor, secondaryColor, applyPreview]);

    function validate(): boolean {
        const next: { primary?: string; secondary?: string } = {};
        if (!HEX.test(primaryColor))
            next.primary = "Use a valid hex (e.g. #1f2937 or #fff)";
        if (!HEX.test(secondaryColor))
            next.secondary = "Use a valid hex (e.g. #22c55e or #0f0)";
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function uploadImage(file: File): Promise<string> {
        if (!file) throw new Error("No file selected");
        if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large (5MB max)");
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/branding/upload`, {
            method: "POST",
            credentials: "include",
            body: fd,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const data = (await res.json()) as { url?: string };
        if (!data?.url) throw new Error("Upload did not return a URL");
        return data.url;
    }

    async function uploadFavicon(file: File): Promise<string> {
        if (!file) throw new Error("No file selected");
        if (!file.name.toLowerCase().endsWith(".ico"))
            throw new Error("Only .ico files are allowed");
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE}/api/branding/upload-favicon`,
            {
                method: "POST",
                credentials: "include",
                body: fd,
            }
        );
        if (!res.ok) throw new Error(`Favicon upload failed (${res.status})`);
        const data = (await res.json()) as { url?: string };
        if (!data?.url) throw new Error("Upload did not return a URL");
        return data.url;
    }

    async function onUpload(which: "light" | "dark" | "loginBg", file: File | null) {
        if (!file) return;
        try {
            if (which === "light") setUploadingLight(true);
            else if (which === "dark") setUploadingDark(true);
            else setUploadingLoginBg(true);

            const url = await uploadImage(file);
            if (which === "light") setLogoLightUrl(url);
            else if (which === "dark") setLogoDarkUrl(url);
            else setLoginBackgroundUrl(url);

            push({ title: "Image uploaded", kind: "success" });
        } catch (e) {
            push({
                title: "Upload failed",
                desc: String((e as Error)?.message ?? e),
                kind: "destructive",
            });
        } finally {
            if (which === "light") setUploadingLight(false);
            else if (which === "dark") setUploadingDark(false);
            else setUploadingLoginBg(false);
        }
    }

    async function onUploadFavicon(file: File | null) {
        if (!file) return;
        try {
            setUploadingFavicon(true);
            const url = await uploadFavicon(file);
            setFaviconUrl(url);
            push({ title: "Favicon uploaded", kind: "success" });
        } catch (e) {
            push({
                title: "Upload failed",
                desc: String((e as Error)?.message ?? e),
                kind: "destructive",
            });
        } finally {
            setUploadingFavicon(false);
        }
    }

    async function onSave() {
        if (!validate()) {
            push({ title: "Please fix the color fields", kind: "destructive" });
            return;
        }
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/branding`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    primaryColor,
                    secondaryColor,
                    logoLightUrl,
                    logoDarkUrl,
                    loginBackgroundUrl,
                    faviconUrl,
                    emailHeader,
                    emailFooter,
                    customCss,
                    allowClientThemeToggle,
                }),
            });
            if (!res.ok) throw new Error(`Save failed (${res.status})`);
            push({ title: "Branding settings saved", kind: "success" });
            await refetch();
            clearPreview();
        } catch (e) {
            push({
                title: "Save failed",
                desc: String((e as Error)?.message ?? e),
                kind: "destructive",
            });
        }
    }

    function onResetPreview() {
        if (!branding) return;
        setPrimaryColor(branding.primaryColor ?? "#09090b");
        setSecondaryColor(branding.secondaryColor ?? "#fafafa");
        setLogoLightUrl(branding.logoLightUrl ?? "");
        setLogoDarkUrl(branding.logoDarkUrl ?? "");
        setLoginBackgroundUrl(branding.loginBackgroundUrl ?? "");
        setFaviconUrl(branding.faviconUrl ?? "");
        setEmailHeader(branding.emailHeader ?? "<h1>{{org_name}}</h1>");
        setEmailFooter(
            branding.emailFooter ?? "<p>Copyright 2025. All rights reserved.</p>"
        );
        setCustomCss(branding.customCss ?? "/* Your custom CSS here */");
        setAllowClientThemeToggle(branding.allowClientThemeToggle ?? true);
        clearPreview();
    }

    return (
        <TabsContent value="branding" className="mt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Branding & Appearance</CardTitle>
                    <CardDescription>
                        Configure brand colors, logos, login artwork, favicon, and email templates. Everything is laid out in tidy paired cards for a clean overview.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Row 1 — Colors | Header Preview (NO top bar preview) */}
                    <PairRow>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Palette className="h-4 w-4" />
                                    Colors
                                </CardTitle>
                                <CardDescription>Define primary & secondary tokens. These drive CSS variables used by shadcn/ui and Tailwind utilities.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <ColorPicker
                                        label="Primary Color"
                                        value={primaryColor}
                                        onChange={setPrimaryColor}
                                        error={errors.primary}
                                    />
                                    <ColorPicker
                                        label="Secondary Color"
                                        value={secondaryColor}
                                        onChange={setSecondaryColor}
                                        error={errors.secondary}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground flex items-start gap-2">
                                    <MonitorSmartphone className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    Use the droplet to sample any visible pixel on the page. If unsupported, the OS color dialog opens instead.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Header preview WITHOUT top bar (top bar color is not adjustable) */}
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Header Preview</CardTitle>
                                <CardDescription>Demonstrates logo swap and components using your colors (no top bar shown).</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border p-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <picture>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <source srcSet={logoDarkUrl || ""} media="(prefers-color-scheme: dark)" />
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={
                                                    logoLightUrl ||
                                                    logoDarkUrl ||
                                                    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                                                }
                                                alt="Logo preview"
                                                className="h-7 w-auto object-contain"
                                            />
                                        </picture>
                                        <span className="text-sm opacity-90">RemoteIQ</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="rounded-md px-3 py-2 text-sm font-medium"
                                            style={{ background: primaryColor, color: "#fff" }}
                                        >
                                            Primary
                                        </button>
                                        <button
                                            className="rounded-md px-3 py-2 text-sm font-medium"
                                            style={{ background: secondaryColor, color: "#111" }}
                                        >
                                            Secondary
                                        </button>
                                    </div>
                                    <div className="mt-4 grid gap-2">
                                        <div className="h-2 w-48 rounded" style={{ background: primaryColor }} />
                                        <div className="h-2 w-40 rounded" style={{ background: secondaryColor }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </PairRow>

                    {/* Row 2 — Logos | Logos Preview */}
                    <PairRow>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4" />
                                    Logos
                                </CardTitle>
                                <CardDescription>Upload or paste URLs for light/dark logos. The app picks the right logo based on theme.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Light logo */}
                                <div className="grid gap-2">
                                    <label className="text-sm">Light Logo</label>
                                    <div className="grid grid-cols-[1fr_auto] gap-2">
                                        <Input
                                            value={logoLightUrl}
                                            onChange={(e) => setLogoLightUrl(e.target.value)}
                                            placeholder="https://cdn.example.com/logo-light.svg"
                                            aria-label="Light logo URL"
                                        />
                                        <div className="flex items-center">
                                            <input
                                                ref={lightInputRef}
                                                type="file"
                                                accept={ACCEPTED_IMAGE_TYPES}
                                                className="hidden"
                                                onChange={(e) => onUpload("light", e.target.files?.[0] ?? null)}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={uploadingLight}
                                                onClick={() => lightInputRef.current?.click()}
                                            >
                                                {uploadingLight ? "Uploading…" : "Upload"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Dark logo */}
                                <div className="grid gap-2">
                                    <label className="text-sm">Dark Logo</label>
                                    <div className="grid grid-cols-[1fr_auto] gap-2">
                                        <Input
                                            value={logoDarkUrl}
                                            onChange={(e) => setLogoDarkUrl(e.target.value)}
                                            placeholder="https://cdn.example.com/logo-dark.svg"
                                            aria-label="Dark logo URL"
                                        />
                                        <div className="flex items-center">
                                            <input
                                                ref={darkInputRef}
                                                type="file"
                                                accept={ACCEPTED_IMAGE_TYPES}
                                                className="hidden"
                                                onChange={(e) => onUpload("dark", e.target.files?.[0] ?? null)}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={uploadingDark}
                                                onClick={() => darkInputRef.current?.click()}
                                            >
                                                {uploadingDark ? "Uploading…" : "Upload"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground flex items-start gap-2">
                                    <ImagePlus className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    Prefer SVGs with transparent backgrounds for crisp rendering across DPIs.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Logos Preview — side by side */}
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Logos Preview</CardTitle>
                                <CardDescription>
                                    Side by side with theme-accurate backgrounds. Light sits on the light background; Dark sits on the dark background.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-full">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-full">
                                    {/* Light tile */}
                                    <div className="rounded-md border p-4 flex flex-col">
                                        <div className="text-sm font-medium mb-2">Light</div>
                                        <div
                                            className="flex-1 rounded-md border grid place-items-center overflow-hidden"
                                            style={{ background: "#ffffff" }}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={
                                                    logoLightUrl ||
                                                    logoDarkUrl ||
                                                    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                                                }
                                                alt="Light logo preview"
                                                className="w-auto object-contain max-h-24 md:max-h-28 lg:max-h-40 max-w-[90%]"
                                            />
                                        </div>
                                    </div>

                                    {/* Dark tile */}
                                    <div className="rounded-md border p-4 flex flex-col dark">
                                        <div className="text-sm font-medium mb-2">Dark</div>
                                        <div
                                            className="flex-1 rounded-md border grid place-items-center overflow-hidden"
                                            style={{ background: "hsl(var(--background))" }}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={
                                                    logoDarkUrl ||
                                                    logoLightUrl ||
                                                    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                                                }
                                                alt="Dark logo preview"
                                                className="w-auto object-contain max-h-24 md:max-h-28 lg:max-h-40 max-w-[90%]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </PairRow>

                    {/* Row 3 — Login Background | Login Page Preview */}
                    <PairRow>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4" />
                                    Login Background
                                </CardTitle>
                                <CardDescription>Set the image behind the login card. We apply a subtle overlay for readability.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <label className="text-sm">Login Background URL</label>
                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                    <Input
                                        value={loginBackgroundUrl}
                                        onChange={(e) => setLoginBackgroundUrl(e.target.value)}
                                        placeholder="https://cdn.example.com/login-bg.jpg"
                                        aria-label="Login background URL"
                                    />
                                    <div className="flex items-center">
                                        <input
                                            ref={loginBgInputRef}
                                            type="file"
                                            accept={ACCEPTED_IMAGE_TYPES}
                                            className="hidden"
                                            onChange={(e) => onUpload("loginBg", e.target.files?.[0] ?? null)}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={uploadingLoginBg}
                                            onClick={() => loginBgInputRef.current?.click()}
                                        >
                                            {uploadingLoginBg ? "Uploading…" : "Upload"}
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Use a large image (e.g., 1920×1080) to avoid pixelation on wide screens.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Login preview */}
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Login Page Preview</CardTitle>
                                <CardDescription>Shows background coverage and primary-colored submit button.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="rounded-md border overflow-hidden relative"
                                    style={{
                                        height: 220,
                                        backgroundColor: "var(--background)",
                                        backgroundImage: loginBackgroundUrl ? `url(${loginBackgroundUrl})` : undefined,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                    }}
                                >
                                    {loginBackgroundUrl && <div className="absolute inset-0 bg-black/30" />}
                                    <div className="absolute inset-0 flex items-center justify-center p-4">
                                        <div className="w-full max-w-[260px] rounded-xl border bg-card/90 backdrop-blur p-4 shadow">
                                            <div className="flex items-center gap-2 mb-3">
                                                <picture>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <source srcSet={logoDarkUrl || ""} media="(prefers-color-scheme: dark)" />
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={
                                                            logoLightUrl ||
                                                            logoDarkUrl ||
                                                            "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                                                        }
                                                        alt="Logo preview"
                                                        className="h-6 w-auto object-contain"
                                                    />
                                                </picture>
                                                <span className="text-sm opacity-80">RemoteIQ</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="h-9 rounded bg-muted" />
                                                <div className="h-9 rounded bg-muted" />
                                                <div className="h-9 rounded" style={{ background: primaryColor }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </PairRow>

                    {/* Row 4 — Favicon | Favicon Preview */}
                    <PairRow>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FaviconIcon className="h-4 w-4" />
                                    Favicon
                                </CardTitle>
                                <CardDescription>Upload a .ico or paste a URL. A default favicon is used if none is set.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <label className="text-sm">Favicon URL (.ico)</label>
                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                    <Input
                                        value={faviconUrl}
                                        onChange={(e) => setFaviconUrl(e.target.value)}
                                        placeholder="https://cdn.example.com/favicon.ico"
                                        aria-label="Favicon URL"
                                    />
                                    <div className="flex items-center">
                                        <input
                                            ref={faviconInputRef}
                                            type="file"
                                            accept={ACCEPTED_FAVICON_TYPES}
                                            className="hidden"
                                            onChange={(e) => onUploadFavicon(e.target.files?.[0] ?? null)}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={uploadingFavicon}
                                            onClick={() => faviconInputRef.current?.click()}
                                        >
                                            {uploadingFavicon ? "Uploading…" : "Upload .ico"}
                                        </Button>
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground flex items-start gap-2">
                                    <InfoIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    Must be an .ico file for upload. You may also link to an external .ico via URL.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Favicon preview */}
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Favicon Preview</CardTitle>
                                <CardDescription>Scaled similarly to a browser tab icon.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {faviconUrl ? (
                                    <div className="flex items-center gap-3">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={faviconUrl} alt="favicon" width={24} height={24} className="rounded" />
                                        <code className="text-xs break-all">{faviconUrl}</code>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No favicon set — the application will use its default until you upload or link one.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </PairRow>

                    {/* Row 5 — Email Header HTML | Email Footer HTML */}
                    <PairRow>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Email Header HTML</CardTitle>
                                <CardDescription>Template snippet injected at the start of outbound emails.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <LabeledTextarea
                                    label="Email Header HTML"
                                    value={emailHeader}
                                    onChange={setEmailHeader}
                                    rows={8}
                                />
                            </CardContent>
                        </Card>

                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-base">Email Footer HTML</CardTitle>
                                <CardDescription>Footer markup appended to outbound emails.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <LabeledTextarea
                                    label="Email Footer HTML"
                                    value={emailFooter}
                                    onChange={setEmailFooter}
                                    rows={8}
                                />
                            </CardContent>
                        </Card>
                    </PairRow>

                    {/* Row 6 — Custom CSS (full width) */}
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-base">Custom CSS</CardTitle>
                            <CardDescription>Advanced overrides get injected after the theme variables.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <LabeledTextarea
                                label="Custom CSS"
                                value={customCss}
                                onChange={setCustomCss}
                                rows={12}
                            />
                            <CheckToggle
                                label="Allow clients to toggle light/dark theme in portal"
                                checked={allowClientThemeToggle}
                                onChange={setAllowClientThemeToggle}
                            />
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                    Images are served from the backend’s <code className="font-mono">/static/uploads</code>.
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={onResetPreview}>Reset Preview</Button>
                                    <Button variant="success" onClick={onSave}>Save Branding</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </TabsContent>
    );
}
