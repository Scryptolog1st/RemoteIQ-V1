// app/customers/layout.tsx
"use client";

import * as React from "react";
import TopBar from "@/components/top-bar";
import { CustomersProvider } from "./customers-context";
import CustomersSidebar from "./customers-sidebar";

/**
 * Customers area shell
 * - Fixed TopBar (56px).
 * - Left sidebar with independent scroll.
 * - Main content uses <main> landmark and skip link for a11y.
 */
export default function CustomersLayout({ children }: { children: React.ReactNode }) {
    return (
        <CustomersProvider>
            {/* Skip to content for keyboard users */}
            <a
                href="#customers-main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 rounded bg-primary px-3 py-2 text-primary-foreground"
            >
                Skip to content
            </a>

            {/* Fixed global header */}
            <TopBar />

            {/* Offset for fixed header (56px) */}
            <div className="pt-14">
                <div className="flex">
                    {/* Local customers sidebar */}
                    <CustomersSidebar />

                    {/* Main content */}
                    <main id="customers-main" className="min-w-0 flex-1 p-4 sm:px-6">
                        {children}
                    </main>
                </div>
            </div>
        </CustomersProvider>
    );
}
