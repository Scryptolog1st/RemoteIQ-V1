"use client";

import * as React from "react";

/** Variants that map to tailwind classes in <Toaster/> */
export type ToastVariant = "default" | "destructive" | "success" | "warning";

export type ToastOptions = {
    id?: string;
    title?: string;
    description?: string;
    variant?: ToastVariant;
    /** Back-compat for older calls: kind === variant */
    kind?: ToastVariant;
    /** Auto-dismiss in ms (0 = stay until closed) */
    duration?: number;
    /** Optional action button (label + onClick) */
    action?: { label: string; onClick: () => void };
};

type ToastInternal = Required<Pick<ToastOptions, "id">> &
    Omit<ToastOptions, "id"> & { createdAt: number };

const listeners = new Set<(list: ToastInternal[]) => void>();
let toasts: ToastInternal[] = [];

/* -------- store helpers -------- */
function notify() {
    for (const l of listeners) l(toasts);
}
function uid() {
    return Math.random().toString(36).slice(2);
}

export function toast(opts: ToastOptions) {
    const id = opts.id ?? uid();
    const variant: ToastVariant = (opts.variant ?? opts.kind ?? "default") as ToastVariant;

    const t: ToastInternal = {
        id,
        title: opts.title ?? "",
        description: opts.description ?? "",
        variant,
        duration: opts.duration ?? 3500,
        action: opts.action,
        createdAt: Date.now(),
    };
    toasts = [t, ...toasts].slice(0, 100);
    notify();
    return { id };
}

export function dismiss(id?: string) {
    if (!id) {
        toasts = [];
    } else {
        toasts = toasts.filter((x) => x.id !== id);
    }
    notify();
}

/** Imperative hook (for components that want to trigger toasts) */
export function useToast() {
    return React.useMemo(
        () => ({
            toast,
            dismiss,
            // Back-compat alias used in some files:
            push: toast,
        }),
        []
    );
}

/** Internal: subscribe to toast store (used by <Toaster/>) */
export function useToastState() {
    const [items, setItems] = React.useState<ToastInternal[]>([]);
    React.useEffect(() => {
        setItems(toasts);
        const sub = (l: ToastInternal[]) => setItems([...l]);
        listeners.add(sub);
        return () => void listeners.delete(sub);
    }, []);
    return items;
}
