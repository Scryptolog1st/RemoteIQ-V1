// app/customers/customers-context.tsx
"use client";

import * as React from "react";
import {
    useDashboard,
    type Device,
    type DeviceStatus,
    type EncodedViewPayload,
} from "@/app/(dashboard)/dashboard-context";

/**
 * Customers page–scoped context
 * - Owns: Customers group open, expanded orgs/sites.
 * - Reads filters from DashboardProvider (single source of truth).
 * - Applies Saved View payloads (initial + subsequent loads).
 */

type OS = Device["os"];

export type CustomersContextType = {
    // Data
    masterDevices: Array<{
        id: string;
        hostname: string;
        alias?: string | null;
        client: string;
        site: string;
        status?: string;
        os?: string;
        user?: string | string[] | null;
        lastResponse?: string;
    }>;
    filteredDevices: CustomersContextType["masterDevices"];

    // Customers tree & expansion
    customersGroupOpen: boolean;
    toggleCustomersGroup: (open?: boolean) => void;
    expandedOrganizations: Set<string>;
    expandedSites: Set<string>;
    onExpandChange: (
        kind: "organization" | "site",
        id: string,
        expanded: boolean,
        childSiteIds?: string[]
    ) => void;
    clearExpanded: () => void;

    // Filters (Status / OS) — mirrored from Dashboard context
    activeFilters: { status: DeviceStatus[]; os: OS[] };
    setActiveFilters: React.Dispatch<
        React.SetStateAction<{ status: DeviceStatus[]; os: OS[] }>
    >;
};

const CustomersContext = React.createContext<CustomersContextType | null>(null);

export function useCustomers() {
    const ctx = React.useContext(CustomersContext);
    if (!ctx) throw new Error("useCustomers must be used within CustomersProvider");
    return ctx;
}

export function CustomersProvider({ children }: { children: React.ReactNode }) {
    // Global (single source of truth)
    const {
        masterDevices: globalDevices,
        activeFilters,
        setActiveFilters,
        getDecodedViewPayload,
        onViewPayload,
    } = useDashboard();

    // Local open/expanded state
    const [customersGroupOpen, setCustomersGroupOpen] = React.useState(true);
    const [expandedOrganizations, setExpandedOrganizations] =
        React.useState<Set<string>>(new Set());
    const [expandedSites, setExpandedSites] =
        React.useState<Set<string>>(new Set());

    const toggleCustomersGroup = React.useCallback((open?: boolean) => {
        setCustomersGroupOpen((prev) => (typeof open === "boolean" ? open : !prev));
    }, []);

    const clearExpanded = React.useCallback(() => {
        setExpandedOrganizations(new Set());
        setExpandedSites(new Set());
    }, []);

    const onExpandChange = React.useCallback(
        (
            kind: "organization" | "site",
            id: string,
            expanded: boolean,
            childSiteIds?: string[]
        ) => {
            if (kind === "organization") {
                setExpandedOrganizations((prev) => {
                    const next = new Set(prev);
                    if (expanded) next.add(id);
                    else next.delete(id);
                    return next;
                });

                // Optional: collapse sites when an org collapses
                if (childSiteIds && Array.isArray(childSiteIds)) {
                    setExpandedSites((prev) => {
                        const next = new Set(prev);
                        if (!expanded) for (const s of childSiteIds) next.delete(s);
                        return next;
                    });
                }
            } else {
                setExpandedSites((prev) => {
                    const next = new Set(prev);
                    if (expanded) next.add(id);
                    else next.delete(id);
                    return next;
                });
            }
        },
        []
    );

    // Normalize devices for table consumption
    const masterDevices = React.useMemo(
        () =>
            (globalDevices ?? []).map((d) => ({
                id: d.id,
                hostname: d.hostname,
                alias: d.alias ?? null,
                client: d.client,
                site: d.site,
                status: d.status,
                os: d.os,
                user: d.user ?? null,
                lastResponse: d.lastResponse,
            })),
        [globalDevices]
    );

    // --- Helpers for filtering (stable refs) ---
    const norm = React.useCallback(
        (s: unknown) => String(s ?? "").trim().toLowerCase(),
        []
    );
    const normStatus = React.useCallback(
        (s: unknown): DeviceStatus => norm(s) as DeviceStatus,
        [norm]
    );

    const filteredDevices = React.useMemo(() => {
        let base: CustomersContextType["masterDevices"] = [];

        const anySites = expandedSites.size > 0;
        const anyOrgs = expandedOrganizations.size > 0;

        if (anySites) {
            // Fix: if sites are selected and some orgs are also selected,
            // require BOTH the site and the org to match to avoid cross-org site name collisions.
            base = masterDevices.filter((d) => {
                const siteMatch = expandedSites.has(d.site);
                const orgGate = anyOrgs ? expandedOrganizations.has(d.client) : true;
                return siteMatch && orgGate;
            });
        } else if (anyOrgs) {
            base = masterDevices.filter((d) => expandedOrganizations.has(d.client));
        } else {
            base = [];
        }

        // Status filter
        if (activeFilters.status.length) {
            const wanted = new Set(activeFilters.status.map((s) => normStatus(s)));
            base = base.filter((d) => wanted.has(normStatus(d.status)));
        }

        // OS filter
        if (activeFilters.os.length) {
            const wantedOS = new Set(activeFilters.os);
            base = base.filter((d) => d.os && wantedOS.has(d.os as OS));
        }

        return base;
    }, [
        masterDevices,
        expandedSites,
        expandedOrganizations,
        activeFilters,
        normStatus, // ✅ stable callback included (fixes the ESLint warning)
    ]);

    // --- Apply payloads (initial + subsequent loads) ---
    const applyPayload = React.useCallback(
        (p: EncodedViewPayload | null | undefined) => {
            if (!p) return;

            // Customers tree state
            if (typeof p.customersGroupOpen === "boolean") {
                setCustomersGroupOpen(p.customersGroupOpen);
            }
            if (Array.isArray(p.expandedOrganizations)) {
                setExpandedOrganizations(new Set(p.expandedOrganizations));
            }
            if (Array.isArray(p.expandedSites)) {
                setExpandedSites(new Set(p.expandedSites));
            }

            // Filters (use global setter so FiltersRail reflects it)
            if (p.activeFilters) {
                const status = Array.isArray(p.activeFilters.status)
                    ? (p.activeFilters.status as DeviceStatus[])
                    : [];
                const os = Array.isArray(p.activeFilters.os)
                    ? (p.activeFilters.os as OS[])
                    : [];
                setActiveFilters({ status, os });
            }
        },
        [setActiveFilters]
    );

    // 1) Apply any decoded payload already present (e.g., from URL on first paint)
    React.useEffect(() => {
        applyPayload(getDecodedViewPayload?.());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2) Subscribe to future payloads (Saved View loads / share link apply)
    React.useEffect(() => {
        const off = onViewPayload?.((p) => applyPayload(p));
        return () => {
            off && off();
        };
    }, [onViewPayload, applyPayload]);

    // Memoize the context value to limit downstream renders
    const value = React.useMemo<CustomersContextType>(
        () => ({
            masterDevices,
            filteredDevices,
            customersGroupOpen,
            toggleCustomersGroup,
            expandedOrganizations,
            expandedSites,
            onExpandChange,
            clearExpanded,
            activeFilters,
            setActiveFilters,
        }),
        [
            masterDevices,
            filteredDevices,
            customersGroupOpen,
            toggleCustomersGroup,
            expandedOrganizations,
            expandedSites,
            onExpandChange,
            clearExpanded,
            activeFilters,
            setActiveFilters,
        ]
    );

    return (
        <CustomersContext.Provider value={value}>
            {children}
        </CustomersContext.Provider>
    );
}
