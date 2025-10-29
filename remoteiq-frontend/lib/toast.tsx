// remoteiq-frontend/lib/toast.ts
"use client";

import * as React from "react";
import {
  toast as coreToast,
  dismiss as coreDismiss,
  type ToastOptions as CoreOptions,
} from "@/components/ui/use-toast";

/**
 * Legacy compatibility:
 *   push({ title, kind: "success" | "destructive" | "default" | "warning", desc })
 * We map to the modern options { variant, description } understood by use-toast.ts
 */
export type PushToast = CoreOptions & {
  desc?: string;
  kind?: "default" | "destructive" | "success" | "warning";
};

export function push(t: PushToast) {
  const { desc, kind, ...rest } = t;

  // Map `kind` -> variant
  const variant =
    (rest as any).variant ??
    (kind === "destructive"
      ? "destructive"
      : kind === "success"
        ? "success"
        : "default");

  coreToast({
    ...rest,
    variant,
    description: (rest as any).description ?? desc,
  });
}

// Re-export basic imperative API
export const toast = coreToast;
export const dismiss = coreDismiss;

// Back-compat: some places still import a provider/viewport from here.
// We don't put Radix Provider here; the Toaster component renders items & viewport.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Back-compat hook returning legacy shape { push, toast, dismiss }
export function useToast() {
  return { push, toast: coreToast, dismiss: coreDismiss };
}

// Optional: keep name for type imports
export type ToastOptions = CoreOptions;
