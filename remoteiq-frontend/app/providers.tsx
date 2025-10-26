// app/providers.tsx
"use client";

import * as React from "react";
import { ToastProvider } from "@/lib/toast";            // ✅ add this
import { TooltipProvider } from "@/components/ui/tooltip";
import AmbientTooltips from "@/components/ambient-tooltips";
import { DashboardProvider } from "@/app/(dashboard)/dashboard-context";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>                                      {/* ✅ now useToast() is safe */}
            <TooltipProvider delayDuration={200}>
                <DashboardProvider>
                    {children}
                    {/* Global, zero-config tooltips for elements with data-tooltip="..." */}
                    <AmbientTooltips />
                </DashboardProvider>
            </TooltipProvider>
        </ToastProvider>
    );
}
