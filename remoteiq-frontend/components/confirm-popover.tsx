//components\confirm-popover.tsx

"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmPopoverProps = {
    /** Use asChild=true if the trigger is already a Button, etc. */
    asChild?: boolean;
    trigger: React.ReactNode;

    title?: string;
    description?: string;

    confirmLabel?: string;
    cancelLabel?: string;

    /** If true, confirm button is styled as destructive (red). */
    destructive?: boolean;

    /** Called when the user clicks confirm. If it returns a promise, we disable buttons during the op. */
    onConfirm: () => void | Promise<void>;

    /** Optional: controlled placement class for content (width, alignment). */
    contentClassName?: string;
};

export function ConfirmPopover({
    asChild,
    trigger,
    title = "Are you sure?",
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    onConfirm,
    contentClassName,
}: ConfirmPopoverProps) {
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    const handleConfirm = async () => {
        try {
            setBusy(true);
            await onConfirm();
            setOpen(false);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild={asChild}>{trigger}</PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                className={cn("w-[260px] p-3", contentClassName)}
            >
                <div className="space-y-2">
                    <div className="text-sm font-medium leading-none">{title}</div>
                    {description ? (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    ) : null}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                            disabled={busy}
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleConfirm}
                            className={cn(
                                destructive
                                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    : ""
                            )}
                            disabled={busy}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default ConfirmPopover;
