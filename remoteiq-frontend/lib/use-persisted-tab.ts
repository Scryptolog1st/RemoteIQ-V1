"use client";

import * as React from "react";

/**
 * Persist and sync a tab value across reloads with URL + localStorage, safely.
 * - Only allows values in `allowed`
 * - Initializes synchronously from ?tab=... or localStorage (if available)
 * - Skips persisting until after initial value is resolved (prevents "profile" overwrite)
 * - Listens to popstate for back/forward
 */
export function usePersistedTab(options: {
    storageKey: string;
    allowed: readonly string[];
    defaultValue: string;
    urlParam?: string; // defaults to "tab"
}) {
    const { storageKey, allowed, defaultValue, urlParam = "tab" } = options;

    const sanitize = React.useCallback(
        (v: unknown): string => (typeof v === "string" && allowed.includes(v) ? v : defaultValue),
        [allowed, defaultValue]
    );

    const readFromUrl = React.useCallback(() => {
        try {
            const url = new URL(window.location.href);
            const q = url.searchParams.get(urlParam);
            if (q) return sanitize(q);
            // legacy hash support: #tab=xyz
            if (url.hash?.startsWith(`#${urlParam}=`)) {
                const raw = url.hash.substring(urlParam.length + 2);
                return sanitize(decodeURIComponent(raw));
            }
        } catch {
            /* ignore */
        }
        return null;
    }, [sanitize, urlParam]);

    // Compute initial value synchronously on the client (so first render is correct)
    const initial = React.useMemo(() => {
        if (typeof window === "undefined") return defaultValue;
        const fromUrl = readFromUrl();
        if (fromUrl) return fromUrl;
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (raw) return sanitize(JSON.parse(raw));
        } catch {
            /* ignore */
        }
        return defaultValue;
    }, [defaultValue, readFromUrl, sanitize, storageKey]);

    const [value, setValue] = React.useState<string>(initial);

    // Track when we've completed the first client render with the resolved initial value
    const initializedRef = React.useRef(false);
    React.useEffect(() => {
        initializedRef.current = true;
    }, []);

    // Persist to storage + URL whenever value changes (but only after init)
    React.useEffect(() => {
        if (typeof window === "undefined") return;
        if (!initializedRef.current) return;

        const v = sanitize(value);

        try {
            window.localStorage.setItem(storageKey, JSON.stringify(v));
        } catch {
            /* ignore */
        }

        try {
            const url = new URL(window.location.href);
            url.searchParams.set(urlParam, v);
            window.history.replaceState(null, "", url.toString());
        } catch {
            /* ignore */
        }
    }, [sanitize, storageKey, urlParam, value]);

    // Handle back/forward navigation
    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const handler = () => {
            const v = readFromUrl();
            if (v) setValue(v);
        };
        window.addEventListener("popstate", handler);
        return () => window.removeEventListener("popstate", handler);
    }, [readFromUrl]);

    const set = React.useCallback((next: string) => setValue((_) => sanitize(next)), [sanitize]);

    return [value, set] as const;
}
