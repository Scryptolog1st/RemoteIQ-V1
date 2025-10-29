// remoteiq-frontend/components/software-tab.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
    ColumnDef,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Trash2, Search } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/lib/toast";

import {
    fetchDeviceSoftware,
    requestUninstallSoftware,
    type DeviceSoftware,
} from "@/lib/api";

/** Same call shape used across the app (title/desc/kind) */
type ToastFn = (t: {
    title?: string;
    desc?: string;
    kind?: "default" | "destructive" | "success" | "warning";
}) => void;

type Props = { push?: ToastFn };

export default function SoftwareTab({ push }: Props) {
    // Back-compat: if parent didn't pass `push` yet, fall back to hook
    const hook = useToast();
    const doPush: ToastFn = push ?? hook.push;

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
            setLoading(true);
            setError(null);
            try {
                const { items } = await fetchDeviceSoftware(deviceId);
                if (!alive) return;
                setData(items);
            } catch (e: any) {
                if (!alive) return;
                setError(e?.message ?? "Failed to load software list");
                doPush({
                    title: "Failed to load software",
                    desc: e?.message ?? "Request failed",
                    kind: "destructive",
                });
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [deviceId, doPush]);

    const doSearchWeb = (name: string, version?: string | null) => {
        const q = encodeURIComponent([name, version].filter(Boolean).join(" "));
        window.open(
            `https://www.google.com/search?q=${q}`,
            "_blank",
            "noopener,noreferrer"
        );
    };

    const doUninstall = async (item: DeviceSoftware) => {
        if (!deviceId) return;
        try {
            const { jobId } = await requestUninstallSoftware(deviceId, {
                name: item.name,
                version: item.version || undefined,
            });
            doPush({
                title: "Uninstall requested",
                desc: `Job ${jobId} queued for ${item.name}.`,
                kind: "success",
            });
            // (optional) you could mark the row as "pending…" here
        } catch (e: any) {
            doPush({
                title: "Uninstall failed",
                desc: e?.message ?? "This device is offline. Ensure the agent is running and connected, then try again.",
                kind: "destructive",
            });
        }
    };

    const columns: ColumnDef<DeviceSoftware>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Name <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
        },
        { accessorKey: "version", header: "Version" },
        { accessorKey: "publisher", header: "Publisher" },
        { accessorKey: "installDate", header: "Install Date" },
        {
            id: "actions",
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Open menu">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(item.name);
                                        doPush({ title: "Copied", desc: "Name copied to clipboard." });
                                    }}
                                >
                                    Copy name
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(item.version || "");
                                        doPush({
                                            title: "Copied",
                                            desc: "Version copied to clipboard.",
                                        });
                                    }}
                                >
                                    Copy version
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => doSearchWeb(item.name, item.version)}>
                                    <Search className="mr-2 h-4 w-4" />
                                    Search web
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-red-600 focus:text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Uninstall…
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Confirm dialog */}
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Uninstall “{item.name}”?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will queue an uninstall job for the agent. The device may prompt
                                    the user and could require a reboot depending on the application.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => doUninstall(item)}>
                                    Uninstall
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                );
            },
        },
    ];

    return (
        <Card>
            <CardContent className="pt-6">
                {loading && (
                    <div className="text-sm text-muted-foreground mb-3">Loading…</div>
                )}
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
