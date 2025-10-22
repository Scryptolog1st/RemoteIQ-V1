export type WSIncoming =
  | { t: "hello"; agentId: string; capabilities: string[]; os: string; arch: string; hostname: string; version: string }
  | { t: "hb"; at: string; metrics?: { cpu?: number; mem?: number } }
  | { t: "job_result"; jobId: string; exitCode: number; stdout: string; stderr: string; startedAt: string; finishedAt: string };

export type WSOutgoing =
  | { t: "ack"; id: string }
  | {
    t: "job_run_script";
    jobId: string;
    language: "powershell" | "bash";
    scriptText: string;
    args?: string[];
    env?: Record<string, string>;
    timeoutSec?: number;
  };
