// app/(auth)/login/page.tsx
"use client";

import * as React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBranding } from "@/app/providers/BrandingProvider";

/** Only allow same-origin paths; never /login or legacy /auth/login */
function safeNext(raw: string | null): string {
    if (!raw) return "/";
    try {
        if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("//")) return "/";
        if (!raw.startsWith("/")) return "/";
        if (raw === "/login" || raw.startsWith("/auth/login")) return "/";
        return raw;
    } catch {
        return "/";
    }
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001").replace(/\/+$/, "");

type LoginOk =
    | { user: any; ok?: true }
    | { status: "2fa_required"; challengeToken: string; jti?: string };

export default function LoginPage() {
    const router = useRouter();
    const params = useSearchParams();
    const nextPath = safeNext(params.get("next"));

    const { branding } = useBranding();

    // Normalize nullable strings -> undefined for JSX props
    const loginBg = branding?.loginBackgroundUrl ?? undefined;
    const logoLight = branding?.logoLightUrl ?? undefined;
    const logoDark = branding?.logoDarkUrl ?? undefined;
    const effectiveLogo = logoLight ?? logoDark ?? "/logo.png"; // always a string

    // Form state
    const [email, setEmail] = React.useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("riq_last_email") ?? "";
        }
        return "";
    });
    const [password, setPassword] = React.useState("");
    const [remember, setRemember] = React.useState(
        () => (typeof window !== "undefined" ? localStorage.getItem("riq_remember") === "1" : false),
    );
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [showPw, setShowPw] = React.useState(false);
    const [capsLock, setCapsLock] = React.useState(false);

    // 2FA step
    const [challengeToken, setChallengeToken] = React.useState<string | null>(null);
    const [otp, setOtp] = React.useState("");
    const [useRecovery, setUseRecovery] = React.useState(false);
    const otpRef = React.useRef<HTMLInputElement | null>(null);

    // Keep localStorage aligned with the remember choice
    React.useEffect(() => {
        if (typeof window === "undefined") return;
        if (remember) {
            localStorage.setItem("riq_remember", "1");
            if (email) localStorage.setItem("riq_last_email", email);
        } else {
            localStorage.removeItem("riq_remember");
            // Optional: keep last email for convenience
        }
    }, [remember, email]);

    const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;
    const canSubmitOtp =
        !!challengeToken &&
        !isLoading &&
        (useRecovery ? otp.trim().length >= 8 : otp.trim().length === 6);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const payload: Record<string, any> = { email: email.trim(), password };
        // If you later add a device fingerprint, pass it here as deviceFingerprint
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                credentials: "include", // set httpOnly cookie
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            // Try to parse JSON even on errors to read structured messages or 2FA status
            let body: LoginOk | any = null;
            try {
                body = await res.json();
            } catch {
                // ignore non-JSON body
            }

            if (!res.ok) {
                let msg = `Login failed (${res.status})`;
                if (body?.message) {
                    if (Array.isArray(body.message)) msg = body.message.join(", ");
                    else msg = String(body.message);
                }
                throw new Error(msg);
            }

            // 2FA branch
            if (body && typeof body === "object" && body.status === "2fa_required" && body.challengeToken) {
                setChallengeToken(body.challengeToken);
                setTimeout(() => otpRef.current?.focus(), 30);
                if (remember) localStorage.setItem("riq_last_email", payload.email);
                return; // stay on the page and render OTP form
            }

            // Regular login success
            if (remember) localStorage.setItem("riq_last_email", payload.email);
            router.replace(nextPath);
        } catch (err: any) {
            setError(String(err?.message ?? err) || "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!challengeToken) return;
        setError(null);
        setIsLoading(true);

        try {
            const body: any = { challengeToken, rememberDevice: remember };
            if (useRecovery) body.recoveryCode = otp.trim();
            else body.code = otp.trim();

            const res = await fetch(`${API_BASE}/api/auth/2fa/verify`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                let msg = `Verification failed (${res.status})`;
                try {
                    const j = await res.json();
                    if (j?.message) {
                        if (Array.isArray(j.message)) msg = j.message.join(", ");
                        else msg = String(j.message);
                    }
                } catch { /* ignore */ }
                throw new Error(msg);
            }

            // On success, API sets cookie; proceed
            router.replace(nextPath);
        } catch (err: any) {
            setError(String(err?.message ?? err) || "Invalid code");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="relative flex min-h-screen items-center justify-center bg-background p-4 bg-cover bg-center"
            style={loginBg ? { backgroundImage: `url(${loginBg})` } : undefined}
        >
            {/* Subtle overlay for readability (only when bg is present) */}
            {loginBg && <div className="pointer-events-none absolute inset-0 bg-black/10" />}

            <Card className="relative z-10 w-full max-w-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <CardHeader className="text-center">
                    <div className="mb-3 flex items-center justify-center gap-2">
                        {/* Prefer brand logos; fall back to icon */}
                        {logoLight || logoDark ? (
                            <picture>
                                {logoDark ? <source srcSet={logoDark} media="(prefers-color-scheme: dark)" /> : null}
                                <img src={effectiveLogo} alt="RemoteIQ" className="h-7 w-auto rounded-sm" />
                            </picture>
                        ) : (
                            <Shield className="h-6 w-6" />
                        )}
                        <CardTitle className="text-2xl">RemoteIQ</CardTitle>
                    </div>
                    <CardDescription>
                        {challengeToken ? "Two-factor authentication required" : "Sign in to your account to continue"}
                    </CardDescription>
                </CardHeader>

                {/* Step 1: Email + Password */}
                {!challengeToken && (
                    <form onSubmit={handleLogin} noValidate>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="username"
                                    inputMode="email"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                                        Forgot password?
                                    </Link>
                                </div>

                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPw ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyUp={(e) => setCapsLock((e as any).getModifierState?.("CapsLock") === true)}
                                        disabled={isLoading}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowPw((s) => !s)}
                                        aria-label={showPw ? "Hide password" : "Show password"}
                                    >
                                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>

                                {capsLock && <p className="text-xs text-amber-600 dark:text-amber-400">Caps Lock is ON</p>}
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="accent-primary h-4 w-4"
                                        checked={remember}
                                        onChange={(e) => setRemember(e.target.checked)}
                                        disabled={isLoading}
                                    />
                                    Remember me
                                </label>
                            </div>

                            {error && <p className="text-sm text-destructive">{error}</p>}
                        </CardContent>

                        <CardFooter className="flex flex-col gap-3">
                            <Button type="submit" className="w-full" disabled={!canSubmit}>
                                {isLoading ? "Signing In..." : "Sign In"}
                            </Button>
                        </CardFooter>
                    </form>
                )}

                {/* Step 2: OTP / Recovery Code */}
                {challengeToken && (
                    <form onSubmit={handleOtpVerify} noValidate>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="otp">{useRecovery ? "Recovery code" : "Authenticator code"}</Label>
                                <Input
                                    id="otp"
                                    ref={otpRef}
                                    inputMode={useRecovery ? "text" : "numeric"}
                                    placeholder={useRecovery ? "enter a backup code" : "123456"}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    disabled={isLoading}
                                />
                                <div className="text-xs text-muted-foreground">
                                    {useRecovery
                                        ? "Enter one of your single-use recovery codes."
                                        : "Open your authenticator app and enter the 6-digit code."}
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        className="accent-primary h-4 w-4"
                                        checked={remember}
                                        onChange={(e) => setRemember(e.target.checked)}
                                        disabled={isLoading}
                                    />
                                    Remember this device
                                </label>

                                <button
                                    type="button"
                                    className="text-sm font-medium text-primary hover:underline"
                                    onClick={() => setUseRecovery((s) => !s)}
                                >
                                    {useRecovery ? "Use 6-digit code" : "Use a recovery code"}
                                </button>
                            </div>

                            {error && <p className="text-sm text-destructive">{error}</p>}
                        </CardContent>

                        <CardFooter className="flex flex-col gap-3">
                            <Button type="submit" className="w-full" disabled={!canSubmitOtp}>
                                {isLoading ? "Verifying..." : "Verify & Sign In"}
                            </Button>
                            <button
                                type="button"
                                className="text-sm text-muted-foreground underline hover:no-underline"
                                onClick={() => {
                                    // allow retrying email+password
                                    setChallengeToken(null);
                                    setOtp("");
                                    setUseRecovery(false);
                                    setError(null);
                                }}
                            >
                                Go back
                            </button>
                        </CardFooter>
                    </form>
                )}
            </Card>
        </div>
    );
}
