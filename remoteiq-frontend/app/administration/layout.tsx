// app/administration/layout.tsx
import * as React from "react";
import TopBar from "@/components/top-bar";

export const metadata = {
    title: "Administration • RemoteIQ",
};

export default function AdministrationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* Global fixed top bar */}
            <TopBar />

            {/* Scroll container for the admin area (no layout shift when scrollbar shows) */}
            <div
                className="bg-background h-[calc(100vh-3.5rem)] overflow-y-scroll"
                style={{ scrollbarGutter: "stable both-edges" }}
            >
                {/* keep the original top spacing so content clears the fixed TopBar */}
                <div className="pt-14">{children}</div>
            </div>
        </>
    );
}
