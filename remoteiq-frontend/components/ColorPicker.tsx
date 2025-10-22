"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PRESETS = [
    "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#06b6d4", "#f59e0b",
    "#111827", "#4b5563", "#9ca3af", "#ffffff",
];

export function ColorPicker({
    label,
    value,
    onChange,
    error,
    className,
    triggerClassName,
}: {
    label: string;
    value: string;
    onChange: (hex: string) => void;
    error?: string;
    className?: string;
    triggerClassName?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [draft, setDraft] = React.useState(value);

    React.useEffect(() => {
        setDraft(value);
    }, [value, open]);

    const valid = HEX.test(draft);

    const apply = () => {
        if (!valid) return;
        onChange(draft);
        setOpen(false);
    };

    return (
        <div className={cn("grid gap-1", className)}>
            <span className="text-sm">{label}</span>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className={cn("justify-start gap-3 h-9", triggerClassName)}>
                        <span
                            className="h-5 w-5 rounded border"
                            style={{ background: HEX.test(value) ? value : "#ffffff" }}
                            aria-hidden
                        />
                        <span className="font-mono text-xs">{value || "Select…"}</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{label}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        {/* Big color input */}
                        <input
                            type="color"
                            value={HEX.test(draft) ? draft : "#ffffff"}
                            onChange={(e) => setDraft(e.target.value)}
                            className="h-10 w-full rounded border cursor-pointer"
                            aria-label={`${label} color`}
                        />

                        {/* Hex input */}
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Hex</label>
                            <Input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="#3b82f6"
                                className={cn(!valid && "border-red-500")}
                            />
                            {!valid && <p className="text-xs text-red-600">Use a valid hex (e.g. #3b82f6 or #fff)</p>}
                        </div>

                        {/* Presets */}
                        <div className="grid gap-2">
                            <label className="text-xs text-muted-foreground">Presets</label>
                            <div className="grid grid-cols-10 gap-2">
                                {PRESETS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setDraft(c)}
                                        className={cn(
                                            "h-7 w-7 rounded border",
                                            draft.toLowerCase() === c ? "ring-2 ring-offset-2 ring-primary" : ""
                                        )}
                                        style={{ background: c }}
                                        aria-label={`Preset ${c}`}
                                        type="button"
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={() => setOpen(false)} type="button">
                                Cancel
                            </Button>
                            <Button onClick={apply} disabled={!valid} type="button">
                                Apply
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
