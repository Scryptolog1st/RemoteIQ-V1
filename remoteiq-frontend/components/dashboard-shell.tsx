//components\dashboard-shell.tsx

"use client";

import * as React from "react";
import { useDashboard } from "@/app/(dashboard)/dashboard-context";
import {
    TOP_BAR_HEIGHT,
    SIDEBAR_WIDTH_COLLAPSED,
    SIDEBAR_WIDTH_EXPANDED,
} from "@/components/layout-constants";

/**
 * Positions the main app content so it's never hidden under the fixed TopBar/Sidebar.
 * This component must be client-side to read sidebar collapse state.
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
    const { isSidebarCollapsed } = useDashboard();

    const paddingLeft = isSidebarCollapsed
        ? SIDEBAR_WIDTH_COLLAPSED
        : SIDEBAR_WIDTH_EXPANDED;

    return (
        <div
            className="min-h-screen bg-background"
            style={{
                paddingTop: TOP_BAR_HEIGHT,
                paddingLeft,
            }}
        >
            {children}
        </div>
    );
}
