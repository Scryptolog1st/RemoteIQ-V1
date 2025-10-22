"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    codes: string[];
};

export default function RecoveryCodesDialog({ open, onOpenChange, codes }: Props) {
    const handleDownload = React.useCallback(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const filename = `recovery-codes-${y}${m}${d}.txt`;

        const header =
            `RemoteIQ Recovery Codes
Generated: ${now.toISOString()}
Each code can be used once. Store these somewhere safe.

`;
        const body = codes.map((c, i) => `${String(i + 1).padStart(2, "0")}. ${c}`).join("\n");
        const blob = new Blob([header, body, "\n"], { type: "text/plain;charset=utf-8" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }, [codes]);

    const handleCopy = React.useCallback(async () => {
        try {
            await navigator.clipboard.writeText(codes.join("\n"));
        } catch {
            // ignore
        }
    }, [codes]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Recovery codes</DialogTitle>
                    <DialogDescription>
                        Store these safely. Each code can be used once.
                    </DialogDescription>
                </DialogHeader>

                {/* Scrollable list without ScrollArea component */}
                <div className="max-h-64 overflow-auto rounded-md border p-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {codes.map((c) => (
                            <div
                                key={c}
                                className="rounded-md bg-muted px-3 py-2 font-mono tracking-wide"
                            >
                                {c}
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="flex w-full items-center justify-between gap-2">
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCopy} aria-label="Copy recovery codes">
                            Copy
                        </Button>
                        <Button variant="outline" onClick={handleDownload} aria-label="Download recovery codes">
                            Download .txt
                        </Button>
                    </div>
                    <Button onClick={() => onOpenChange(false)} aria-label="Close">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
