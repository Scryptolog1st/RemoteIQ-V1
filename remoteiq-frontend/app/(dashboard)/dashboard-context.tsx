// app/(dashboard)/dashboard-context.tsx
"use client";

import * as React from "react";
import type {
    ColumnFiltersState,
    SortingState,
    VisibilityState,
} from "@tanstack/react-table";

import { useDevices, type UiFilters as UiDeviceFilters } from "@/lib/use-devices";
import type { Device as ApiDevice } from "@/lib/api";

/** Accept both TitleCase and lowercase (preserving your existing type) */
export type DeviceStatus =
    | "Healthy" | "Warning" | "Critical" | "Offline"
    | "healthy" | "warning" | "critical" | "offline";

export type Device = {
    id: string;
    hostname: string;
    alias?: string | null;
    status: DeviceStatus;
    client: string; // organization
    site: string;
    os: "Windows" | "Linux" | "macOS";
    user?: string | string[] | null;
    lastResponse: string;
};

export type ActiveFilters = {
    status: DeviceStatus[];
    os: Array<Device["os"]>;
};

// Lightweight RGL types (no runtime dep on react-grid-layout here)
export type RglLayout = {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    static?: boolean;
    moved?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
};
export type RglLayouts = {
    lg?: RglLayout[];
    md?: RglLayout[];
    sm?: RglLayout[];
    xs?: RglLayout[];
    xxs?: RglLayout[];
};

export type SavedView = {
    id: string;
    name: string;

    // Table state
    columnVisibility: VisibilityState;
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;

    // (Customers bits supplied by CustomersProvider via snapshot)
    customersGroupOpen?: boolean;
    expandedOrganizations?: string[];
    expandedSites?: string[];
    activeFilters?: ActiveFilters;

    // Dashboard
    dashboardOrder?: string[];
    dashboardLayouts?: RglLayouts | null;
    dashboardHidden?: string[];
};

/* ----------------------- DEFAULTs ------------------------ */
/** Match the keys used on app/(dashboard)/page.tsx */
export const DEFAULT_DASHBOARD_ORDER: string[] = [
    "kpi-healthy",
    "kpi-critical",
    "kpi-warning",
    "kpi-total",
    "donut-os",
    "heat-status-os",
    "stack-client-sites",
    "donut-client",
    "table-offline",
    "donut-status",
];

/* ----------------------- localStorage helpers ------------------------ */
const LS_SAVED_VIEWS_KEY = "remoteiq.savedViews.v2";
const LS_LAST_VIEW_ID_KEY = "remoteiq.lastSavedViewId.v2";
const LS_ALIASES_KEY = "remoteiq.deviceAliases.v1";
const LS_SIDEBAR_COLLAPSED = "remoteiq.sidebarCollapsed.v1";

function safeReadJSON<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}
function safeWriteJSON<T>(key: string, value: T) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch { }
}
const readSavedViews = () => safeReadJSON<SavedView[]>(LS_SAVED_VIEWS_KEY, []);
const writeSavedViews = (v: SavedView[]) => safeWriteJSON(LS_SAVED_VIEWS_KEY, v);
const readLastViewId = () =>
    typeof window !== "undefined" ? window.localStorage.getItem(LS_LAST_VIEW_ID_KEY) : null;
const writeLastViewId = (id: string | null) => {
    if (typeof window === "undefined") return;
    try {
        id
            ? window.localStorage.setItem(LS_LAST_VIEW_ID_KEY, id)
            : window.localStorage.removeItem(LS_LAST_VIEW_ID_KEY);
    } catch { }
};
const readAliases = () => safeReadJSON<Record<string, string>>(LS_ALIASES_KEY, {});
const writeAliases = (map: Record<string, string>) => safeWriteJSON(LS_ALIASES_KEY, map);

/* ----------------------- URL payload ------------------------ */
export type EncodedViewPayload = {
    version: 3;
    columnVisibility: VisibilityState;
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState;

    // From CustomersProvider if present
    customersGroupOpen?: boolean;
    expandedOrganizations?: string[];
    expandedSites?: string[];
    activeFilters?: ActiveFilters;

    // Dashboard
    dashboardOrder?: string[];
    dashboardLayouts?: RglLayouts | null;
    dashboardHidden?: string[];
};

const toBase64Url = (json: string) => {
    const b64 =
        typeof window !== "undefined"
            ? window.btoa(unescape(encodeURIComponent(json)))
            : Buffer.from(json, "utf-8").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const fromBase64Url = (s: string) => {
    const pad = "===".slice((s.length + 3) % 4);
    const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json =
        typeof window !== "undefined"
            ? decodeURIComponent(escape(window.atob(norm)))
            : Buffer.from(norm, "base64").toString("utf-8");
    return json;
};
const encodePayloadToQuery = (p: EncodedViewPayload) => {
    try {
        return toBase64Url(JSON.stringify(p));
    } catch {
        return "";
    }
};
const decodePayloadFromQuery = (s: string | null): EncodedViewPayload | null => {
    if (!s) return null;
    try {
        const parsed = JSON.parse(fromBase64Url(s));
        return parsed?.version >= 2 ? (parsed as EncodedViewPayload) : null;
    } catch {
        return null;
    }
};

/* ----------------------- Snapshot getter ------------------------ */
type Snapshot = {
    columnVisibility: VisibilityState;
    sorting: SortingState;
    columnFilters: ColumnFiltersState;

    // Optional page-specific add-ons (supplied by page providers)
    customersGroupOpen?: boolean;
    expandedOrganizations?: string[];
    expandedSites?: string[];
    activeFilters?: ActiveFilters;

    dashboardOrder?: string[];
    dashboardLayouts?: RglLayouts | null;
    dashboardHidden?: string[];
};
type SnapshotGetter = () => Snapshot;

/* ----------------------- Context ------------------------ */
type DashboardContextType = {
    // data
    masterDevices: Device[];
    filteredDevices: Device[]; // equals masterDevices here; server-side filters applied via useDevices

    // table
    columnVisibility: VisibilityState;
    setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>;
    sorting: SortingState;
    setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
    columnFilters: ColumnFiltersState;
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;

    // saved views
    savedViews: SavedView[];
    saveCurrentView: (name: string) => void;
    loadView: (id: string) => boolean;
    deleteView: (id: string) => void;
    overwriteViewFromCurrent: (id: string) => boolean;
    renameView: (id: string, newName: string) => boolean;

    // misc filters
    operatingSystems: Array<Device["os"]>;
    activeFilters: ActiveFilters;
    setActiveFilters: React.Dispatch<React.SetStateAction<ActiveFilters>>;

    // dashboard-only state
    dashboardOrder: string[];
    setDashboardOrder: React.Dispatch<React.SetStateAction<string[]>>;
    dashboardLayouts: RglLayouts | null;
    setDashboardLayouts: React.Dispatch<React.SetStateAction<RglLayouts | null>>;
    dashboardHidden: string[];
    setDashboardHidden: React.Dispatch<React.SetStateAction<string[]>>;

    // sidebar UI state
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

    // alias editing
    updateDeviceAlias: (id: string, alias: string | null | undefined) => void;

    // Saved Views + page integration
    registerSnapshotGetter: (getter: SnapshotGetter | null) => void;

    // HYDRATION GATE
    ready: boolean;

    // encode current view to URL payload (optionally include dashboard layouts)
    getEncodedCurrentView: (opts?: { includeLayouts?: boolean }) => string;

    // expose decoded payload & subscribe for page providers
    getDecodedViewPayload: () => EncodedViewPayload | null;
    onViewPayload: (cb: (p: EncodedViewPayload) => void) => () => void;
};

const DashboardContext = React.createContext<DashboardContextType | null>(null);
export const useDashboard = () => {
    const ctx = React.useContext(DashboardContext);
    if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
    return ctx;
};

/* ----------------------- API → UI mapping ------------------------ */
function mapApiToUi(dev: ApiDevice): Device {
    // Map API status "online"/"offline" → UI "Healthy"/"Offline"
    const status: DeviceStatus = dev.status === "online" ? "Healthy" : "Offline";

    // Pass through client/site/user (API types may not declare them yet → optional chain / fallback)
    const anyDev = dev as unknown as {
        client?: string | null;
        site?: string | null;
        user?: string | string[] | null;
    };

    return {
        id: dev.id,
        hostname: dev.hostname || "",
        alias: null,
        status,
        client: anyDev.client ?? "—",
        site: anyDev.site ?? "—",
        user: anyDev.user ?? null,
        os:
            (dev.os?.toLowerCase() === "linux"
                ? "Linux"
                : dev.os?.toLowerCase() === "macos"
                    ? "macOS"
                    : "Windows") as Device["os"],
        lastResponse: dev.lastSeen ?? "—",
    };
}

/* ----------------------- Provider ------------------------ */
export function DashboardProvider({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = React.useState(false);

    // devices from backend (server-side filtered via UiDeviceFilters)
    const {
        items,
        uiFilters,
        setUiFilters,
    } = useDevices(25);

    // Build masterDevices from API items
    const [masterDevices, setMasterDevices] = React.useState<Device[]>([]);
    React.useEffect(() => {
        setMasterDevices((items ?? []).map(mapApiToUi));
    }, [items]);

    // table
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    // views
    const [savedViews, setSavedViews] = React.useState<SavedView[]>([]);

    // misc
    const operatingSystems = React.useMemo<Array<Device["os"]>>(
        () => ["Windows", "Linux", "macOS"],
        []
    );
    const [activeFilters, setActiveFilters] = React.useState<ActiveFilters>({
        status: [],
        os: [],
    });

    /* ---------- Dashboard-only ---------- */
    const [dashboardOrder, setDashboardOrder] = React.useState<string[]>(
        DEFAULT_DASHBOARD_ORDER
    );
    const [dashboardLayouts, setDashboardLayouts] = React.useState<RglLayouts | null>(null);
    const [dashboardHidden, setDashboardHidden] = React.useState<string[]>([]);

    /* ---------- Sidebar collapsed UI state ---------- */
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        try {
            const v = window.localStorage.getItem(LS_SIDEBAR_COLLAPSED);
            return v ? JSON.parse(v) === true : false;
        } catch {
            return false;
        }
    });
    React.useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(LS_SIDEBAR_COLLAPSED, JSON.stringify(isSidebarCollapsed));
            } catch { }
        }
    }, [isSidebarCollapsed]);

    /* ---------- Saved Views: persistence ---------- */
    React.useEffect(() => {
        setSavedViews(readSavedViews());
    }, []);
    React.useEffect(() => {
        writeSavedViews(savedViews);
    }, [savedViews]);

    /* ---------- Snapshot getter (page contributes) ---------- */
    const snapshotGetterRef = React.useRef<SnapshotGetter | null>(null);
    const registerSnapshotGetter = React.useCallback((g: SnapshotGetter | null) => {
        snapshotGetterRef.current = g;
    }, []);

    const captureCurrentViewState = React.useCallback(
        (): Omit<SavedView, "id" | "name"> => {
            const snap = snapshotGetterRef.current?.();
            return {
                columnVisibility: snap?.columnVisibility ?? columnVisibility,
                sorting: snap?.sorting ?? sorting,
                columnFilters: snap?.columnFilters ?? columnFilters,

                // Customers bits (if current page provides them)
                customersGroupOpen: snap?.customersGroupOpen,
                expandedOrganizations: snap?.expandedOrganizations,
                expandedSites: snap?.expandedSites,
                activeFilters: snap?.activeFilters ?? activeFilters,

                dashboardOrder: snap?.dashboardOrder ?? dashboardOrder,
                dashboardLayouts: snap?.dashboardLayouts ?? dashboardLayouts ?? null,
                dashboardHidden: snap?.dashboardHidden ?? dashboardHidden ?? [],
            };
        },
        [
            columnVisibility,
            sorting,
            columnFilters,
            dashboardOrder,
            dashboardLayouts,
            dashboardHidden,
            activeFilters,
        ]
    );

    /* ---------- Decoded payload sharing to page providers ---------- */
    const lastDecodedPayloadRef = React.useRef<EncodedViewPayload | null>(null);
    const listenersRef = React.useRef(new Set<(p: EncodedViewPayload) => void>());

    const getDecodedViewPayload = React.useCallback(() => lastDecodedPayloadRef.current, []);
    const onViewPayload = React.useCallback((cb: (p: EncodedViewPayload) => void) => {
        listenersRef.current.add(cb);
        return () => listenersRef.current.delete(cb);
    }, []);
    const emitViewPayload = React.useCallback((p: EncodedViewPayload) => {
        lastDecodedPayloadRef.current = p;
        for (const fn of Array.from(listenersRef.current)) {
            try {
                fn(p);
            } catch { }
        }
    }, []);

    /* ---------- HYDRATE FROM URL / LAST VIEW, THEN RENDER ---------- */
    React.useEffect(() => {
        // aliases (optional)
        const aliases = readAliases();
        if (aliases && Object.keys(aliases).length) {
            setMasterDevices((prev) =>
                prev.map((d) => (aliases[d.id] ? { ...d, alias: aliases[d.id] } : d))
            );
        }

        const url = new URL(window.location.href);
        const encoded = url.searchParams.get("v");
        const payload = decodePayloadFromQuery(encoded);

        if (payload) {
            // apply base/table/dashboard here
            setColumnVisibility(payload.columnVisibility ?? {});
            setSorting(payload.sorting ?? []);
            setColumnFilters(payload.columnFilters ?? []);
            if (Array.isArray(payload.dashboardOrder) && payload.dashboardOrder.length) {
                setDashboardOrder(payload.dashboardOrder);
            }
            if (payload.dashboardLayouts) setDashboardLayouts(payload.dashboardLayouts);
            if (payload.dashboardHidden) setDashboardHidden(payload.dashboardHidden);

            // ✅ restore filters if present
            if (payload.activeFilters) setActiveFilters(payload.activeFilters);

            // let page providers (e.g., Customers) apply their own bits
            emitViewPayload(payload);

            setReady(true);
            return;
        }

        // No ?v= — fall back to last saved view
        const lastId = readLastViewId();
        const views = readSavedViews();
        if (lastId && views.some((v) => v.id === lastId)) {
            const v = views.find((x) => x.id === lastId)!;

            setColumnVisibility(v.columnVisibility ?? {});
            setSorting(v.sorting ?? []);
            setColumnFilters(v.columnFilters ?? []);

            if (Array.isArray(v.dashboardOrder) && v.dashboardOrder.length) {
                setDashboardOrder(v.dashboardOrder);
            }
            setDashboardLayouts(v.dashboardLayouts ?? null);
            setDashboardHidden(v.dashboardHidden ?? []);

            // ✅ also restore filters from the view if present
            if (v.activeFilters) setActiveFilters(v.activeFilters);

            // also emit to page providers so they can adopt customers bits
            emitViewPayload({
                version: 3,
                columnVisibility: v.columnVisibility ?? {},
                sorting: v.sorting ?? [],
                columnFilters: v.columnFilters ?? [],
                customersGroupOpen: v.customersGroupOpen,
                expandedOrganizations: v.expandedOrganizations,
                expandedSites: v.expandedSites,
                activeFilters: v.activeFilters,
                dashboardOrder: v.dashboardOrder,
                dashboardLayouts: v.dashboardLayouts ?? null,
                dashboardHidden: v.dashboardHidden ?? [],
            });
        }

        setReady(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------- Bridge ActiveFilters → backend UiFilters ---------- */
    React.useEffect(() => {
        // Map your UI ActiveFilters to the server-side UiDeviceFilters
        const ui: UiDeviceFilters = {
            status: (() => {
                const s = activeFilters.status ?? [];
                const hasOffline = s.some((x) => String(x).toLowerCase() === "offline");
                const hasAnyOnline = s.some((x) => {
                    const v = String(x).toLowerCase();
                    return v === "healthy" || v === "warning" || v === "critical";
                });
                // use-devices consumes lowercase enums
                if (hasOffline && !hasAnyOnline) return ["offline"];
                if (!hasOffline && hasAnyOnline) return ["healthy", "warning", "critical"];
                if (hasOffline && hasAnyOnline) return ["healthy", "warning", "critical", "offline"];
                return undefined;
            })(),
            os: (activeFilters.os ?? []).length
                ? (activeFilters.os as ("Windows" | "Linux" | "macOS")[])
                : undefined,
        };
        setUiFilters(ui);
    }, [activeFilters, setUiFilters]);

    // Encode current view (optionally include layouts/hidden)
    const getEncodedCurrentView = React.useCallback(
        (opts?: { includeLayouts?: boolean }) => {
            const snap = captureCurrentViewState();
            const includeLayouts = !!opts?.includeLayouts;
            return encodePayloadToQuery({
                version: 3,
                columnVisibility: snap.columnVisibility,
                sorting: snap.sorting,
                columnFilters: snap.columnFilters,

                customersGroupOpen: snap.customersGroupOpen,
                expandedOrganizations: snap.expandedOrganizations,
                expandedSites: snap.expandedSites,
                activeFilters: snap.activeFilters,

                dashboardOrder: snap.dashboardOrder,
                ...(includeLayouts
                    ? {
                        dashboardLayouts: snap.dashboardLayouts ?? null,
                        dashboardHidden: snap.dashboardHidden ?? [],
                    }
                    : {}),
            });
        },
        [captureCurrentViewState]
    );

    // alias editing
    const updateDeviceAlias = React.useCallback((id: string, alias?: string | null) => {
        const trimmed = alias?.trim() || "";
        setMasterDevices((prev) => {
            const next = prev.map((d) => (d.id === id ? { ...d, alias: trimmed || null } : d));
            const map: Record<string, string> = {};
            for (const dev of next) if (dev.alias && dev.alias.trim()) map[dev.id] = dev.alias.trim();
            writeAliases(map);
            return next;
        });
    }, []);

    const value: DashboardContextType = {
        // data
        masterDevices,
        filteredDevices: masterDevices, // server-side filtering handled via useDevices + effect above

        // table
        columnVisibility,
        setColumnVisibility,
        sorting,
        setSorting,
        columnFilters,
        setColumnFilters,

        // saved views
        savedViews,
        saveCurrentView: (name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return;

            setSavedViews((prev) => {
                if (prev.some((v) => v.name.toLowerCase() === trimmed.toLowerCase())) return prev;
                const snapshot = captureCurrentViewState();
                const view: SavedView = {
                    id: Math.random().toString(36).slice(2),
                    name: trimmed,
                    ...snapshot,
                };
                const next = [view, ...prev].slice(0, 100);

                const url = new URL(window.location.href);
                url.searchParams.set(
                    "v",
                    encodePayloadToQuery({
                        version: 3,
                        columnVisibility: snapshot.columnVisibility,
                        sorting: snapshot.sorting,
                        columnFilters: snapshot.columnFilters,

                        customersGroupOpen: snapshot.customersGroupOpen,
                        expandedOrganizations: snapshot.expandedOrganizations,
                        expandedSites: snapshot.expandedSites,
                        activeFilters: snapshot.activeFilters,

                        dashboardOrder: snapshot.dashboardOrder,
                    })
                );
                history.replaceState(null, "", url.toString());
                writeLastViewId(view.id);

                return next;
            });
        },
        loadView: (id: string) => {
            let found: SavedView | undefined;
            setSavedViews((prev) => {
                found = prev.find((v) => v.id === id);
                return prev;
            });
            if (!found) return false;

            setColumnVisibility(found.columnVisibility ?? {});
            setSorting(found.sorting ?? []);
            setColumnFilters(found.columnFilters ?? []);
            if (Array.isArray(found.dashboardOrder) && found.dashboardOrder.length) {
                setDashboardOrder(found.dashboardOrder);
            }
            setDashboardLayouts(found.dashboardLayouts ?? null);
            setDashboardHidden(found.dashboardHidden ?? []);

            if (found.activeFilters) setActiveFilters(found.activeFilters);

            const payload: EncodedViewPayload = {
                version: 3,
                columnVisibility: found!.columnVisibility ?? {},
                sorting: found!.sorting ?? [],
                columnFilters: found!.columnFilters ?? [],
                customersGroupOpen: found!.customersGroupOpen,
                expandedOrganizations: found!.expandedOrganizations,
                expandedSites: found!.expandedSites,
                activeFilters: found!.activeFilters,
                dashboardOrder: found!.dashboardOrder ?? DEFAULT_DASHBOARD_ORDER,
                dashboardLayouts: found!.dashboardLayouts ?? null,
                dashboardHidden: found!.dashboardHidden ?? [],
            };

            const url = new URL(window.location.href);
            url.searchParams.set("v", encodePayloadToQuery(payload));
            history.replaceState(null, "", url.toString());
            writeLastViewId(found!.id);

            emitViewPayload(payload);
            return true;
        },
        deleteView: (id: string) => {
            setSavedViews((prev) => {
                const next = prev.filter((v) => v.id !== id);
                const lastId = readLastViewId();
                if (lastId && lastId === id) writeLastViewId(null);
                return next;
            });
        },
        overwriteViewFromCurrent: (id: string) => {
            const snapshot = captureCurrentViewState();
            let ok = false;
            setSavedViews((prev) => {
                const idx = prev.findIndex((v) => v.id === id);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], ...snapshot };
                ok = true;

                const payload: EncodedViewPayload = {
                    version: 3,
                    columnVisibility: snapshot.columnVisibility,
                    sorting: snapshot.sorting,
                    columnFilters: snapshot.columnFilters,
                    customersGroupOpen: snapshot.customersGroupOpen,
                    expandedOrganizations: snapshot.expandedOrganizations,
                    expandedSites: snapshot.expandedSites,
                    activeFilters: snapshot.activeFilters,
                    dashboardOrder: snapshot.dashboardOrder,
                    dashboardLayouts: snapshot.dashboardLayouts ?? null,
                    dashboardHidden: snapshot.dashboardHidden ?? [],
                };

                const url = new URL(window.location.href);
                url.searchParams.set("v", encodePayloadToQuery(payload));
                history.replaceState(null, "", url.toString());
                writeLastViewId(next[idx].id);

                emitViewPayload(payload);
                return next;
            });
            return ok;
        },
        renameView: (id: string, newName: string) => {
            const trimmed = newName.trim();
            if (!trimmed) return false;
            let ok = false;
            setSavedViews((prev) => {
                if (prev.some((v) => v.name.toLowerCase() === trimmed.toLowerCase() && v.id !== id)) {
                    return prev;
                }
                const idx = prev.findIndex((v) => v.id === id);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], name: trimmed };
                ok = true;
                return next;
            });
            return ok;
        },

        // misc
        operatingSystems,
        activeFilters,
        setActiveFilters,

        // dashboard-only
        dashboardOrder,
        setDashboardOrder,
        dashboardLayouts,
        setDashboardLayouts,
        dashboardHidden,
        setDashboardHidden,

        // sidebar state
        isSidebarCollapsed,
        setIsSidebarCollapsed,

        // alias
        updateDeviceAlias,

        // page integration
        registerSnapshotGetter,

        // hydration
        ready,

        // share link
        getEncodedCurrentView,

        // decoded view payload sharing
        getDecodedViewPayload,
        onViewPayload,
    };

    // Gate children until URL/last-view hydration is done (prevents flicker)
    if (!ready) return null;

    return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
