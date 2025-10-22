// lib/use-devices.ts
"use client";

import * as React from "react";
import type { Device, DevicesResponse, DeviceFilters } from "./api";
import { fetchDevices } from "./api";

/** Your dashboard context uses lowercase statuses */
export type DeviceStatus = "healthy" | "warning" | "critical" | "offline";

/** UI-side filters coming from your rail/dashboard context */
export type UiFilters = {
  q?: string;
  status?: DeviceStatus[];                  // lowercase, matches your context
  os?: Array<"Windows" | "Linux" | "macOS">;
};

type UseDevicesOptions = {
  /** debounce milliseconds for q changes (default 300) */
  debounceMs?: number;
  /** optional initial filters */
  initialFilters?: UiFilters;
};

function toBackendFilters(ui?: UiFilters): DeviceFilters | undefined {
  if (!ui) return undefined;

  const offline = ui.status?.includes("offline");
  const anyOnline =
    (ui.status ?? []).some((s) => s === "healthy" || s === "warning" || s === "critical");

  const status = offline ? "offline" : anyOnline ? "online" : undefined;
  const os = (ui.os ?? []).map((o) => o.toLowerCase());

  return {
    q: ui.q,
    status,
    os: os.length ? os : undefined,
  };
}

/** small hook utility to debounce a value */
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useDevices(initialPageSize = 25, opts: UseDevicesOptions = {}) {
  const { debounceMs = 300, initialFilters } = opts;

  const [items, setItems] = React.useState<Device[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [uiFilters, setUiFilters] = React.useState<UiFilters>(initialFilters ?? {});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);

  // Debounce q only; status/os changes should refresh immediately
  const debouncedQ = useDebouncedValue(uiFilters.q, debounceMs);

  // ✅ Memoize the composite object so callbacks get a stable reference
  const debouncedFilters: UiFilters = React.useMemo(
    () => ({
      q: debouncedQ,
      status: uiFilters.status,
      os: uiFilters.os,
    }),
    [debouncedQ, uiFilters.status, uiFilters.os]
  );

  // Track and cancel in-flight requests when filters/page change
  const abortRef = React.useRef<AbortController | null>(null);
  const cancelInFlight = React.useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  /** Load FIRST page (cursor = null) — stable deps (no cursor) */
  const reload = React.useCallback(async () => {
    cancelInFlight();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const resp: DevicesResponse = await fetchDevices(
        pageSize,
        null,
        toBackendFilters(debouncedFilters)
      );
      if (ac.signal.aborted) return;
      setItems(resp.items);
      setCursor(resp.nextCursor);
      setHasMore(Boolean(resp.nextCursor));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message ?? "Error");
      setItems([]);
      setCursor(null);
      setHasMore(false);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [pageSize, debouncedFilters, cancelInFlight]);

  /** Load NEXT page (uses current cursor) */
  const loadMore = React.useCallback(async () => {
    if (!cursor) return;
    cancelInFlight();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const resp: DevicesResponse = await fetchDevices(
        pageSize,
        cursor,
        toBackendFilters(debouncedFilters)
      );
      if (ac.signal.aborted) return;
      setItems((prev) => [...prev, ...resp.items]);
      setCursor(resp.nextCursor);
      setHasMore(Boolean(resp.nextCursor));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message ?? "Error");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [pageSize, cursor, debouncedFilters, cancelInFlight]);

  /** Effect: refresh first page whenever pageSize or filters (debounced q) change */
  React.useEffect(() => {
    reload();
    // cancel on unmount
    return cancelInFlight;
  }, [reload, cancelInFlight]);

  /** Optional helper to hard reset state + reload (e.g., tenant switch) */
  const hardReset = React.useCallback((nextFilters?: UiFilters) => {
    setItems([]);
    setCursor(null);
    setUiFilters(nextFilters ?? {});
    // reload will be triggered by filters change effect
  }, []);

  return {
    items,
    loading,
    error,
    hasMore,
    pageSize,
    setPageSize,
    uiFilters,
    setUiFilters,
    loadMore,
    refresh: reload,
    hardReset,
  };
}
