// app/(dashboard)/layout.tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import TopBar from "@/components/top-bar";
import Sidebar from "@/components/sidebar";

/**
 * Dashboard area shell
 * - Global TopBar (fixed 56px).
 * - Optional left Sidebar (only on /devices…; the /customers area renders its own sidebar).
 * - Main content scrolls independently.
 *
 * NOTE: DashboardProvider is already mounted at the app root (via app/providers.tsx),
 * so we intentionally do NOT wrap another provider here to avoid double contexts.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen">
            <TopBar />
            <SidebarVisibility>{children}</SidebarVisibility>
        </div>
    );
}

/**
 * Shows the global Sidebar only on Devices pages.
 * - Dashboard ("/"): hide sidebar
 * - Customers ("/customers…"): hide (Customers has its own sidebar/layout)
 * - Devices ("/devices…"): show sidebar
 */
function SidebarVisibility({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showSidebar = pathname?.startsWith("/devices");

    return (
        <div className="flex w-full" style={{ paddingTop: 56 /* TopBar height */ }}>
            {showSidebar && (
                <aside className="hidden md:block w-64 shrink-0 border-r bg-background">
                    <Sidebar />
                </aside>
            )}
            <section className="flex-1 min-w-0">{children}</section>
        </div>
    );
}
