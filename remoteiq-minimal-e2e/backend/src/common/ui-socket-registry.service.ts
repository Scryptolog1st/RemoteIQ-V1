import { Injectable, Logger } from "@nestjs/common";
import type { WebSocket } from "ws";

/**
 * UI (dashboard) socket with metadata.
 * - userId: authenticated user identifier (string)
 * - subscriptions: deviceIds this socket has subscribed to
 */
export type UiSocket = WebSocket & {
    userId?: string;
    subscriptions?: Set<string>;
};

function isOpen(ws: WebSocket): boolean {
    // 'OPEN' is a numeric const on ws WebSocket instances
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (ws as any).readyState === (ws as any).OPEN;
}

/**
 * Registry for **dashboard/user** WebSocket connections and their subscriptions.
 * Isolation from the Agent socket registry keeps privileges and broadcasting clean.
 *
 * Notes:
 * - In-memory only (per-process). For multi-node deployments, back this with Redis or a message bus.
 * - Broadcast methods return the number of sockets that were attempted (best-effort).
 */
@Injectable()
export class UiSocketRegistry {
    private readonly log = new Logger("UiSocketRegistry");

    /** All sockets for a given user */
    private socketsByUser = new Map<string, Set<UiSocket>>();

    /** Subscribers for a given deviceId */
    private socketsByDevice = new Map<string, Set<UiSocket>>();

    /** Track every active socket for cleanup/metrics */
    private allSockets = new Set<UiSocket>();

    /* ---------------------------- Socket lifecycle ---------------------------- */

    /** Register a new UI socket for a specific user (auth already verified). */
    add(userId: string, socket: UiSocket): void {
        socket.userId = String(userId);
        socket.subscriptions = socket.subscriptions ?? new Set<string>();

        // Per-user index
        if (!this.socketsByUser.has(userId)) this.socketsByUser.set(userId, new Set());
        this.socketsByUser.get(userId)!.add(socket);

        // Global index
        this.allSockets.add(socket);
    }

    /** Remove a UI socket from all indexes (called on close/error). */
    remove(socket: UiSocket): void {
        // Unsubscribe from all device topics first
        if (socket.subscriptions && socket.subscriptions.size) {
            for (const deviceId of socket.subscriptions) {
                this.unsubscribe(socket, deviceId);
            }
            socket.subscriptions.clear();
        }

        // Detach from per-user map
        const uid = socket.userId;
        if (uid && this.socketsByUser.has(uid)) {
            const set = this.socketsByUser.get(uid)!;
            set.delete(socket);
            if (set.size === 0) this.socketsByUser.delete(uid);
        }

        // Global index
        this.allSockets.delete(socket);
    }

    /** Remove all sockets for a given user (e.g., on logout/revoke). */
    removeAllForUser(userId: string): number {
        const set = this.socketsByUser.get(userId);
        if (!set || !set.size) return 0;
        let n = 0;
        for (const s of Array.from(set)) {
            try {
                // Close with policy code; UI can auto-reconnect if appropriate
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (s as any).close?.(4401, "User sessions revoked");
            } catch { /* ignore */ }
            this.remove(s);
            n++;
        }
        return n;
    }

    /* ----------------------------- Subscriptions ------------------------------ */

    /** Subscribe a socket to a device topic (idempotent). */
    subscribe(socket: UiSocket, deviceId: string): void {
        const id = String(deviceId);
        socket.subscriptions = socket.subscriptions ?? new Set<string>();
        if (socket.subscriptions.has(id)) return;

        socket.subscriptions.add(id);

        if (!this.socketsByDevice.has(id)) this.socketsByDevice.set(id, new Set());
        this.socketsByDevice.get(id)!.add(socket);
    }

    /** Unsubscribe a socket from a device topic (no-op if not subscribed). */
    unsubscribe(socket: UiSocket, deviceId: string): void {
        const id = String(deviceId);
        if (socket.subscriptions && socket.subscriptions.has(id)) {
            socket.subscriptions.delete(id);
        }
        const set = this.socketsByDevice.get(id);
        if (set) {
            set.delete(socket);
            if (set.size === 0) this.socketsByDevice.delete(id);
        }
    }

    /** Unsubscribe a socket from all topics. */
    unsubscribeAll(socket: UiSocket): void {
        if (!socket.subscriptions) return;
        for (const id of Array.from(socket.subscriptions)) {
            this.unsubscribe(socket, id);
        }
    }

    /* -------------------------------- Broadcasts ------------------------------ */

    /** Broadcast to all UI sockets (rare; prefer topic broadcasts). */
    broadcastAll(payload: unknown): number {
        const msg = JSON.stringify(payload);
        let sent = 0;
        for (const s of this.allSockets) {
            if (!isOpen(s)) continue;
            try {
                s.send(msg);
                sent++;
            } catch {
                /* ignore per-socket send errors */
            }
        }
        return sent;
    }

    /** Broadcast to all sockets subscribed to a specific deviceId. */
    broadcastToDevice(deviceId: string, payload: unknown): number {
        const set = this.socketsByDevice.get(String(deviceId));
        if (!set || set.size === 0) return 0;
        const msg = JSON.stringify(payload);
        let sent = 0;
        for (const s of set) {
            if (!isOpen(s)) continue;
            try {
                s.send(msg);
                sent++;
            } catch {
                /* ignore per-socket send errors */
            }
        }
        return sent;
    }

    /** Broadcast to all sockets for a given userId (e.g., personal notices). */
    broadcastToUser(userId: string, payload: unknown): number {
        const set = this.socketsByUser.get(String(userId));
        if (!set || set.size === 0) return 0;
        const msg = JSON.stringify(payload);
        let sent = 0;
        for (const s of set) {
            if (!isOpen(s)) continue;
            try {
                s.send(msg);
                sent++;
            } catch {
                /* ignore per-socket send errors */
            }
        }
        return sent;
    }

    /* --------------------------------- Metrics -------------------------------- */

    countAll(): number {
        return this.allSockets.size;
    }
    countUsers(): number {
        return this.socketsByUser.size;
    }
    countDeviceSubscribers(deviceId: string): number {
        const set = this.socketsByDevice.get(String(deviceId));
        return set ? set.size : 0;
    }
}
