// components/patch-tab.tsx

"use client"

import React from "react"
import { ColumnDef, SortingState, ColumnFiltersState, VisibilityState } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { DataTable } from '@/components/data-table'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

// --- Type and Mock Data ---
type PatchStatus = "Installed" | "Required" | "Pending";
export type Patch = {
    id: string
    kbArticle: string
    description: string
    category: string
    status: PatchStatus
    installedOn: string | null
}

const mockPatches: Patch[] = [
    { id: "1", kbArticle: "KB501356", description: "Cumulative Update for Windows 10 Version 22H2", category: "Security Updates", status: "Installed", installedOn: "2023-10-10" },
    { id: "2", kbArticle: "KB5011323", description: ".NET Framework 3.5 and 4.8.1 Update", category: "Updates", status: "Installed", installedOn: "2023-10-10" },
    { id: "3", kbArticle: "KB5021289", description: "Cumulative Update for Windows 10 Version 22H2", category: "Security Updates", status: "Required", installedOn: null },
    { id: "4", kbArticle: "KB890830", description: "Windows Malicious Software Removal Tool", category: "Tools", status: "Pending", installedOn: null },
];

// --- Column Definitions ---
export const columns: ColumnDef<Patch>[] = [
    {
        accessorKey: "kbArticle",
        header: ({ column }) => (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                KB Article <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
    },
    {
        accessorKey: "description",
        header: "Description",
    },
    {
        accessorKey: "category",
        header: "Category",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as PatchStatus;

            if (status === "Installed") {
                // Green pill
                return (
                    <Badge
                        className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                        variant="secondary"
                    >
                        Installed
                    </Badge>
                );
            }
            if (status === "Pending") {
                // Neutral gray pill
                return (
                    <Badge
                        className="bg-muted text-foreground/80 border border-border hover:bg-muted"
                        variant="outline"
                    >
                        Pending
                    </Badge>
                );
            }
            // Required -> red (destructive)
            return <Badge variant="destructive">Required</Badge>;
        },
    },
    {
        accessorKey: "installedOn",
        header: "Installed On",
    },
    {
        id: "actions",
        cell: () => (
            <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
            </Button>
        ),
    },
]

// --- Main Component ---
export default function PatchTab() {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

    return (
        <Card>
            <CardContent className="pt-6">
                <DataTable
                    columns={columns}
                    data={mockPatches}
                    sorting={sorting}
                    setSorting={setSorting}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    columnVisibility={columnVisibility}
                    setColumnVisibility={setColumnVisibility}
                    filterColumn="description"
                    filterInputPlaceholder="Filter by description..."
                />
            </CardContent>
        </Card>
    )
}
