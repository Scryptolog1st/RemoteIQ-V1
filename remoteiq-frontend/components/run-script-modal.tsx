// components/run-script-modal.tsx
"use client";

import * as React from "react";
import { Play, Loader2, Info } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { useJobRun } from "@/lib/use-job-run";

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    /** Explicit single target device */
    deviceId?: string;
    /** Optional list of preselected devices (e.g., from table). For now we use the first one. */
    preselectDeviceIds?: string[];
};

export default function RunScriptModal({
    open,
    onOpenChange,
    deviceId,
    preselectDeviceIds,
}: Props) {
    const [script, setScript] = React.useState<string>("");
    const [shell, setShell] = React.useState<"powershell" | "bash" | "cmd">("powershell");
    const [timeoutSec, setTimeoutSec] = React.useState<number>(120);

    // Choose a target device: explicit deviceId wins, else first preselected.
    const targetDeviceId = React.useMemo(
        () => deviceId ?? preselectDeviceIds?.[0],
        [deviceId, preselectDeviceIds]
    );

    const { jobId, status, log, progress, error, subscribed, start } = useJobRun();
    const busy = status === "queued" || status === "running";
    const canSubmit = Boolean(targetDeviceId && script.trim().length > 0 && shell);

    async function onSubmit() {
        if (!canSubmit) return;
        await start({ deviceId: targetDeviceId!, script, shell, timeoutSec });
    }

    // Clear form when modal fully closes
    React.useEffect(() => {
        if (!open) {
            setScript("");
            setShell("powershell");
            setTimeoutSec(120);
        }
    }, [open]);

    const multiCount = preselectDeviceIds?.length ?? 0;
    const showingMultiNotice = multiCount > 1 && !deviceId;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        Run Script
                    </DialogTitle>
                    <DialogDescription>
                        Send a one-off script to a device and stream live output.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {showingMultiNotice && (
                        <div className="flex items-start gap-2 rounded border p-2 text-xs bg-muted/30">
                            <Info className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>
                                <div className="font-medium">Multiple devices selected</div>
                                <div>
                                    You selected {multiCount} devices. For now, this modal will run on the first
                                    selected device only (<code>{targetDeviceId}</code>). Multi-device execution will
                                    be added later.
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                            <label className="text-xs text-muted-foreground">Shell</label>
                            <Select value={shell} onValueChange={(v) => setShell(v as any)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select shell" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="powershell">PowerShell</SelectItem>
                                    <SelectItem value="bash">Bash</SelectItem>
                                    <SelectItem value="cmd">CMD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-muted-foreground">Timeout (seconds)</label>
                            <input
                                type="number"
                                min={10}
                                max={3600}
                                value={timeoutSec}
                                onChange={(e) =>
                                    setTimeoutSec(Math.max(10, Math.min(3600, Number(e.target.value || 0))))
                                }
                                className="w-full border rounded px-2 py-1 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground">Target device</label>
                        <div className="text-xs rounded border bg-muted/30 px-2 py-1">
                            {targetDeviceId ?? "— none selected —"}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground">Script</label>
                        <Textarea
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                            rows={8}
                            placeholder={
                                shell === "powershell"
                                    ? "Write PowerShell here..."
                                    : shell === "bash"
                                        ? "Write Bash here..."
                                        : "Write CMD here..."
                            }
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                            {jobId ? `Job: ${jobId}` : subscribed ? "Ready" : "Connecting…"}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                                Close
                            </Button>
                            <Button onClick={onSubmit} disabled={!canSubmit || busy} className="gap-2">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                {busy ? (status === "queued" ? "Queued…" : `Running… ${progress}%`) : "Run"}
                            </Button>
                        </div>
                    </div>

                    <div className="border rounded p-2 bg-muted/30 h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">
                        {log || (error ? `Error: ${error}` : "Output will appear here…")}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
