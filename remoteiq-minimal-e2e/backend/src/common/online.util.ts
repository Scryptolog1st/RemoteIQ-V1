// src/common/online.util.ts
export function isAgentOnline(lastHeartbeatAt?: Date | null, thresholdMs = 30_000): boolean {
    if (!lastHeartbeatAt) return false;
    return Date.now() - new Date(lastHeartbeatAt).getTime() < thresholdMs;
}
