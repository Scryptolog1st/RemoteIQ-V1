// remoteiq-frontend/components/ui/toaster.tsx
"use client";

import * as React from "react";
import * as Toast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { dismiss, useToastState } from "./use-toast";

const base =
    "pointer-events-auto rounded-md border px-3 py-2 shadow-md bg-background text-foreground";
const variants = {
    default: "",
    destructive: "border-red-600 bg-red-600/10",
    success: "border-emerald-600 bg-emerald-600/10",
} as const;
type VariantKey = keyof typeof variants;

export default function Toaster() {
    const items = useToastState();

    return (
        <Toast.Provider swipeDirection="right">
            {/* Bottom-right corner; stack grows upward */}
            <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
                <div className="flex w-full max-w-sm flex-col-reverse gap-2">
                    {items.map((t) => {
                        const variantKey: VariantKey =
                            (t as any).variant ?? ("default" as VariantKey);
                        return (
                            <Toast.Root
                                key={t.id}
                                duration={(t as any).duration}
                                className={`group ${base} ${variants[variantKey]}`}
                                onOpenChange={(open) => {
                                    if (!open) dismiss(t.id);
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0">
                                        {(t as any).title ? (
                                            <Toast.Title className="text-sm font-semibold">
                                                {(t as any).title}
                                            </Toast.Title>
                                        ) : null}
                                        {(t as any).description ? (
                                            <Toast.Description className="mt-0.5 text-xs text-muted-foreground break-words">
                                                {(t as any).description}
                                            </Toast.Description>
                                        ) : null}
                                    </div>

                                    <div className="ml-auto flex items-center gap-2 pl-2">
                                        {(t as any).action ? (
                                            <Toast.Action asChild altText={(t as any).action.label}>
                                                <button
                                                    onClick={(t as any).action.onClick}
                                                    className="text-xs underline text-muted-foreground hover:text-foreground"
                                                >
                                                    {(t as any).action.label}
                                                </button>
                                            </Toast.Action>
                                        ) : null}
                                        <Toast.Close
                                            aria-label="Close"
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </Toast.Close>
                                    </div>
                                </div>
                            </Toast.Root>
                        );
                    })}
                </div>
            </div>

            {/* Bottom-right viewport to enable swipe/aria; matches visual position */}
            <Toast.Viewport className="fixed bottom-4 right-4 z-[60] outline-none" />
        </Toast.Provider>
    );
}
