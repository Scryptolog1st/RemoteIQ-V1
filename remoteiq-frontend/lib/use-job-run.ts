// lib/use-job-run.ts
"use client";

import * as React from "react";
import { onWsMessage, ensureSocket } from "./ws";
import { postRunScript, type RunScriptRequest } from "./api";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type JobUpdate = {
    type: "job.run.updated";
    jobId: string;
    status: JobStatus;
    progress?: number;       // 0..100
    chunk?: string;          // log delta
    exitCode?: number | null;
    finishedAt?: string | null;
};

export function useJobRun() {
    const [jobId, setJobId] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<JobStatus | null>(null);
    const [log, setLog] = React.useState<string>("");
    const [progress, setProgress] = React.useState<number>(0);
    const [error, setError] = React.useState<string | null>(null);
    const [subscribed, setSubscribed] = React.useState(false);

    // Subscribe to WS updates for the active jobId
    React.useEffect(() => {
        ensureSocket();
        const unsubscribe = onWsMessage((msg: any) => {
            if (msg?.type !== "job.run.updated") return;
            const data = msg as JobUpdate;
            if (!jobId || data.jobId !== jobId) return;

            setStatus(data.status);
            if (typeof data.progress === "number") setProgress(data.progress);
            if (data.chunk) setLog((prev) => prev + data.chunk);
            if (data.status === "failed") {
                setError(`Run failed${data.exitCode != null ? ` (exit ${data.exitCode})` : ""}`);
            }
        });
        setSubscribed(true);

        // Ensure cleanup returns void (not boolean)
        return () => {
            if (typeof unsubscribe === "function") {
                // swallow any return value to satisfy React types
                void unsubscribe();
            }
        };
    }, [jobId]);

    const start = React.useCallback(async (req: RunScriptRequest) => {
        setError(null);
        setLog("");
        setProgress(0);
        setStatus("queued");
        const res = await postRunScript(req);
        setJobId(res.jobId);
        return res.jobId;
    }, []);

    return {
        jobId,
        status,
        log,
        progress,
        error,
        subscribed,
        start,
    };
}
