"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "warning" | "destructive" | "default";
export type Toast = { id: string; title: string; desc?: string; kind?: ToastKind; action?: { label: string; onClick: () => void } };
type Store = { toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; remove: (id: string) => void; };
const ToastCtx = React.createContext<Store | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const remove = React.useCallback((id: string) => setToasts((x) => x.filter((t) => t.id !== id)), []);
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, kind: "default", ...t }]);
    window.setTimeout(() => remove(id), 4200);
  }, [remove]);
  const value = React.useMemo(() => ({ toasts, push, remove }), [toasts, push, remove]);
  return <ToastCtx.Provider value={value}>{children}</ToastCtx.Provider>;
}
export function useToast() { const ctx = React.useContext(ToastCtx); if (!ctx) throw new Error("useToast must be used within <ToastProvider>"); return ctx; }
export function ToastViewport() {
  const { toasts } = useToast();
  return (<div className="fixed bottom-4 right-4 z-[100] space-y-2">{toasts.map((t) => (<ToastItem key={t.id} toast={t} />))}</div>);
}
function ToastItem({ toast: t }: { toast: Toast }) {
  const { remove } = useToast();
  const klass = t.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
    : t.kind === "warning" ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-200"
    : t.kind === "destructive" ? "border-red-200 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200"
    : "border-border bg-card text-card-foreground";
  return (
    <div className={cn("w-[340px] rounded-md border px-4 py-3 shadow-md", klass)} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{t.title}</div>
          {t.desc && <div className="mt-1 text-xs/5 opacity-90">{t.desc}</div>}
        </div>
        <div className="flex items-center gap-2">
          {t.action && (<button className="text-xs underline underline-offset-2 hover:opacity-80" onClick={t.action.onClick}>{t.action.label}</button>)}
          <button aria-label="Dismiss" className="text-xs opacity-70 hover:opacity-100" onClick={() => remove(t.id)}>×</button>
        </div>
      </div>
    </div>
  );
}
