"use client";

import * as React from "react";
import TopBar from "@/components/top-bar";
import { DashboardProvider } from "@/app/(dashboard)/dashboard-context";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardProvider>
            {/* Global top bar reused here */}
            <TopBar />
            {/* Offset for the fixed top bar (56px) */}
            <div className="pt-14 min-h-screen">
                <section className="mx-auto max-w-5xl p-4 sm:px-6 sm:py-6">
                    {children}
                </section>
            </div>
        </DashboardProvider>
    );
}
