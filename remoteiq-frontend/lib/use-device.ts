// lib/use-device.ts
"use client";

import * as React from "react";
import type { Device } from "./api";
import { fetchDevice } from "./api";

/**
 * Fetch a single device from the backend by ID.
 * Returns loading/error state and a refresh() helper.
 */
export function useDevice(id?: string | null) {
    const [device, setDevice] = React.useState<Device | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        if (!id) return;
        setLoading(true); setError(null);
        try {
            const d = await fetchDevice(id);
            setDevice(d);
        } catch (e: any) {
            setError(e?.message ?? "Error");
            setDevice(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    React.useEffect(() => { load(); }, [load]);

    return { device, loading, error, refresh: load };
}
