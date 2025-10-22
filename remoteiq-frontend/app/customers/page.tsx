// app/customers/page.tsx
"use client";

import * as React from "react";
import {
    useDashboard,
    type Device,
    type DeviceStatus,
} from "@/app/(dashboard)/dashboard-context";
import { useCustomers } from "@/app/customers/customers-context";
import FiltersRail from "@/components/filters-rail";
import DeviceTable from "@/components/device-table";

function EmptyEndpointsState() {
    return (
        <main className="flex h-[calc(100vh-56px)] items-center justify-center p-8">
            <div className="text-center">
                <h2 className="text-lg font-semibold">Select a customer or site</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Expand one or more customer/site groups in the sidebar to see their devices.
                </p>
            </div>
        </main>
    );
}

// --- normalization helpers ---
const normStatus = (s: unknown): DeviceStatus =>
    String(s ?? "").trim().toLowerCase() as DeviceStatus;
const normOs = (s: unknown): string => String(s ?? "").trim().toLowerCase();

const OS_MAP: Record<string, string> = {
    windows: "windows",
    "microsoft windows": "windows",
    linux: "linux",
    macos: "macos",
    "mac os": "macos",
    osx: "macos",
};
const toOsKey = (s: unknown) => OS_MAP[normOs(s)] ?? normOs(s);

export default function CustomersPage() {
    const {
        masterDevices,

        // table state (participates in Saved Views)
        sorting,
        setSorting,
        columnVisibility,
        setColumnVisibility,
        columnFilters,
        setColumnFilters,

        // Saved Views snapshot registrar
        registerSnapshotGetter,

        // global filters
        activeFilters, // { status: DeviceStatus[], os: Device["os"][] }
    } = useDashboard();

    const {
        customersGroupOpen,
        expandedOrganizations,
        expandedSites,
    } = useCustomers();

    // Register a snapshot getter so Saved Views capture Customers scope + table state + filters
    React.useEffect(() => {
        const off = registerSnapshotGetter(() => ({
            columnVisibility,
            sorting,
            columnFilters,

            // Customers bits:
            customersGroupOpen,
            expandedOrganizations: Array.from(expandedOrganizations),
            expandedSites: Array.from(expandedSites),
            activeFilters,
        }));
        return () => {
            // Unregister when navigating away
            registerSnapshotGetter(null);
            void off; // (no-op; pattern keeps parity if you later return a disposer)
        };
    }, [
        registerSnapshotGetter,
        columnVisibility,
        sorting,
        columnFilters,
        customersGroupOpen,
        expandedOrganizations,
        expandedSites,
        activeFilters,
    ]);

    const nothingExpanded =
        customersGroupOpen &&
        expandedOrganizations.size === 0 &&
        expandedSites.size === 0;

    const statusFilterSet = React.useMemo(() => {
        const arr = activeFilters.status ?? [];
        return new Set(arr.map(normStatus));
    }, [activeFilters.status]);

    const osFilterSet = React.useMemo(() => {
        const arr = activeFilters.os ?? [];
        return new Set(arr.map(toOsKey));
    }, [activeFilters.os]);

    const matchesStatus = React.useCallback(
        (d: Device) => {
            if (!statusFilterSet.size) return true;
            return statusFilterSet.has(normStatus(d.status));
        },
        [statusFilterSet]
    );

    const matchesOs = React.useCallback(
        (d: Device) => {
            if (!osFilterSet.size) return true;
            return osFilterSet.has(toOsKey(d.os));
        },
        [osFilterSet]
    );

    const matchesSidebarScope = React.useCallback(
        (d: Device) => {
            if (expandedOrganizations.size === 0 && expandedSites.size === 0) return false;

            const orgSelected =
                expandedOrganizations.size > 0 ? expandedOrganizations.has(d.client) : false;

            const siteSelected =
                expandedSites.size > 0 ? expandedSites.has(d.site) : false;

            if (expandedSites.size > 0) {
                const orgGate = expandedOrganizations.size > 0 ? orgSelected : true;
                return siteSelected && orgGate;
            }

            if (expandedOrganizations.size > 0) {
                return orgSelected;
            }

            return false;
        },
        [expandedOrganizations, expandedSites]
    );

    const filteredForView = React.useMemo(() => {
        return masterDevices.filter(
            (d) => matchesSidebarScope(d) && matchesOs(d) && matchesStatus(d)
        );
    }, [masterDevices, matchesSidebarScope, matchesOs, matchesStatus]);

    if (nothingExpanded) return <EmptyEndpointsState />;

    return (
        <main className="grid grid-cols-12 gap-4 p-4 sm:px-6 sm:py-0">
            <aside className="col-span-12 md:col-span-3 lg:col-span-2 pt-4">
                <FiltersRail />
            </aside>
            <section className="col-span-12 md:col-span-9 lg:col-span-10 pt-4 min-w-0">
                <DeviceTable
                    dataOverride={filteredForView}
                    filterColumnId="hostname"
                    filterPlaceholder="Filter devices…"
                    compact={false}
                />
            </section>
        </main>
    );
}
