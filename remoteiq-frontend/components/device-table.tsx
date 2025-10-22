// components/device-table.tsx
"use client";

import * as React from "react";
import type {
    SortingState,
    VisibilityState,
    ColumnFiltersState,
} from "@tanstack/react-table";

import { useDashboard, type Device } from "@/app/(dashboard)/dashboard-context";
import { DataTable } from "@/components/data-table";
import { columns } from "@/components/device-table-columns";
import { useDevices } from "@/lib/use-devices";
import type { DeviceStatus as HookDeviceStatus } from "@/lib/use-devices";

type Props = {
    dataOverride?: Device[];
    filterColumnId?: string;
    filterPlaceholder?: string;
    compact?: boolean;
};

export default function DeviceTable({
    dataOverride,
    filterColumnId = "hostname",
    filterPlaceholder = "Filter devices…",
    compact = false,
}: Props) {
    const {
        // table state
        sorting,
        setSorting,
        columnVisibility,
        setColumnVisibility,
        columnFilters,
        setColumnFilters,

        // 🔌 Saved Views glue
        registerSnapshotGetter,
        // onTableStateChange, // <- optional if you add it to context later

        // legacy local source (kept for dataOverride and backward-compat)
        filteredDevices,

        // filters coming from your left rail (Status/OS)
        activeFilters,
    } = useDashboard();

    // === Backend link-up ===

    // derive "q" from this table's filter input for the chosen column
    const q =
        (columnFilters.find((f) => f.id === (filterColumnId ?? "hostname"))
            ?.value as string) || undefined;

    // Normalize TitleCase -> lowercase for the hook; memoized for clean deps
    const uiFilters = React.useMemo(() => {
        const normalizedStatus = (activeFilters?.status ?? [])
            .map((s) => (typeof s === "string" ? s.toLowerCase() : s)) as HookDeviceStatus[];
        return {
            q,
            status: normalizedStatus,
            os: activeFilters?.os, // ["Windows" | "Linux" | "macOS"]
        };
    }, [q, activeFilters]);

    // fetch from /api/devices with cursor pagination
    const {
        items,
        loading,
        error,
        hasMore,
        pageSize,
        setPageSize,
        setUiFilters,
        loadMore,
        refresh,
    } = useDevices(25);

    // push current filters into the hook whenever they change
    React.useEffect(() => {
        setUiFilters(uiFilters);
    }, [uiFilters, setUiFilters]);

    // Final data source: prefer override, else live items from API
    const data: Device[] = React.useMemo(
        () =>
            Array.isArray(dataOverride)
                ? dataOverride
                : ((items as unknown) as Device[]), // cast through unknown to UI Device shape
        [dataOverride, items]
    );

    return (
        <>
            <DataTable<Device, unknown>
                columns={columns}
                data={data}
                filterColumn={filterColumnId}
                filterInputPlaceholder={filterPlaceholder}
                sorting={sorting as SortingState}
                setSorting={setSorting as React.Dispatch<React.SetStateAction<SortingState>>}
                columnVisibility={columnVisibility as VisibilityState}
                setColumnVisibility={
                    setColumnVisibility as React.Dispatch<React.SetStateAction<VisibilityState>>
                }
                columnFilters={columnFilters as ColumnFiltersState}
                setColumnFilters={
                    setColumnFilters as React.Dispatch<React.SetStateAction<ColumnFiltersState>>
                }
                compact={compact}
                // ✅ Saved Views snapshot registration preserved
                registerSnapshotGetter={registerSnapshotGetter}
            // onTableStateChange={onTableStateChange} // optional
            />

            {/* Optional, lightweight backend pagination + controls (non-breaking) */}
            <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                    {loading ? "Loading…" : error ? (
                        <span className="text-destructive">{String(error)}</span>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    <select
                        className="border rounded px-2 py-1"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        title="Rows per page (server fetch)"
                    >
                        {[10, 25, 50, 100, 200].map((n) => (
                            <option key={n} value={n}>
                                {n}/page
                            </option>
                        ))}
                    </select>

                    <button
                        className="border rounded px-2 py-1"
                        onClick={refresh}
                        disabled={loading}
                    >
                        {loading ? "Loading…" : "Refresh"}
                    </button>

                    {hasMore && (
                        <button
                            className="border rounded px-3 py-1"
                            onClick={loadMore}
                            disabled={loading}
                        >
                            {loading ? "Loading…" : "Load more"}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
