// components/filters-rail.tsx
"use client";

import * as React from "react";
import {
    useDashboard,
    type DeviceStatus,
    type Device,
} from "@/app/(dashboard)/dashboard-context";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

// Canonical labels for the UI (and what we store)
const STATUS_LABELS = ["Healthy", "Warning", "Critical", "Offline"] as const;
type StatusLabel = (typeof STATUS_LABELS)[number];

export default function FiltersRail() {
    const {
        operatingSystems, // e.g. ["Windows", "Linux", "macOS"]
        activeFilters,    // { status: DeviceStatus[]; os: Device["os"][] }
        setActiveFilters,
    } = useDashboard();

    // Build OS options from canonical values in context
    const osOptions = React.useMemo(
        () =>
            (operatingSystems ?? []).map((os) => ({
                key: os as Device["os"], // ensure canonical union type
                label: os === "macOS" ? "macOS" : os,
            })),
        [operatingSystems]
    );

    // Sets for quick membership checks
    const statusSet = React.useMemo(
        () => new Set(activeFilters.status ?? []),
        [activeFilters.status]
    );
    const osSet = React.useMemo(
        () => new Set(activeFilters.os ?? []),
        [activeFilters.os]
    );

    // Mutators (strictly typed)
    const toggleStatus = (label: StatusLabel, checked: boolean) => {
        const key = label as DeviceStatus; // TitleCase is valid in your union
        setActiveFilters((prev) => {
            const curr = new Set<DeviceStatus>(prev.status ?? []);
            if (checked) curr.add(key);
            else curr.delete(key);
            return { ...prev, status: Array.from(curr) as DeviceStatus[] };
        });
    };

    const toggleOs = (os: Device["os"], checked: boolean) => {
        setActiveFilters((prev) => {
            const curr = new Set<Device["os"]>(prev.os ?? []);
            if (checked) curr.add(os);
            else curr.delete(os);
            return { ...prev, os: Array.from(curr) as Device["os"][] };
        });
    };

    // Merge so future fields (if any) aren't wiped
    const clearAll = () =>
        setActiveFilters((prev) => ({
            ...prev,
            status: [] as DeviceStatus[],
            os: [] as Device["os"][],
        }));

    return (
        <Card className="p-3 space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Filters</div>
                {/* Destructive button with simple shade change on hover */}
                <Button
                    variant="destructive"
                    size="sm"
                    className="hover:bg-destructive/80"
                    onClick={clearAll}
                    title="Clear all filters"
                    aria-label="Clear all filters"
                >
                    Clear
                </Button>
            </div>

            <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Status</div>
                <div className="space-y-2">
                    {STATUS_LABELS.map((label) => {
                        const checked = statusSet.has(label as DeviceStatus);
                        return (
                            <label key={label} className="flex items-center gap-2">
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => toggleStatus(label, v === true)}
                                    aria-label={label}
                                />
                                <span className="text-sm">{label}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <Separator />

            <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">OS</div>
                <div className="space-y-2">
                    {osOptions.map(({ key, label }) => {
                        const checked = osSet.has(key);
                        return (
                            <label key={key} className="flex items-center gap-2">
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => toggleOs(key, v === true)}
                                    aria-label={label}
                                />
                                <span className="text-sm">{label}</span>
                            </label>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}
