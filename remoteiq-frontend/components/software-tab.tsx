// components/software-tab.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ColumnDef, SortingState, ColumnFiltersState, VisibilityState } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchDeviceSoftware, type DeviceSoftware } from "@/lib/api";

// --- Column Definitions ---
export const columns: ColumnDef<DeviceSoftware>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Name <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
    },
    { accessorKey: "version", header: "Version" },
    { accessorKey: "publisher", header: "Publisher" },
    { accessorKey: "installDate", header: "Install Date" },
    {
        id: "actions",
        cell: () => (
            <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
            </Button>
        ),
    },
];

export default function SoftwareTab() {
    const params = useParams<{ deviceId: string }>();
    const deviceId = params?.deviceId;

    const [data, setData] = React.useState<DeviceSoftware[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

    React.useEffect(() => {
        let alive = true;
        (async () => {
            if (!deviceId) return;
            setLoading(true); setError(null);
            try {
                const { items } = await fetchDeviceSoftware(deviceId);
                if (!alive) return;
                setData(items);
            } catch (e: any) {
                if (!alive) return;
                setError(e?.message ?? "Failed to load software list");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [deviceId]);

    return (
        <Card>
            <CardContent className="pt-6">
                {loading && <div className="text-sm text-muted-foreground mb-3">Loading…</div>}
                {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
                <DataTable
                    columns={columns}
                    data={data}
                    sorting={sorting}
                    setSorting={setSorting}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    columnVisibility={columnVisibility}
                    setColumnVisibility={setColumnVisibility}
                    filterColumn="name"
                    filterInputPlaceholder="Filter by name..."
                />
            </CardContent>
        </Card>
    );
}
