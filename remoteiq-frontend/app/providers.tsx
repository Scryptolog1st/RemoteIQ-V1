// app/providers.tsx
"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import AmbientTooltips from "@/components/ambient-tooltips";
import { DashboardProvider } from "@/app/(dashboard)/dashboard-context";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <TooltipProvider delayDuration={200}>
            <DashboardProvider>
                {children}
                {/* Global, zero-config tooltips for elements with data-tooltip="..." */}
                <AmbientTooltips />
            </DashboardProvider>
        </TooltipProvider>
    );
}
