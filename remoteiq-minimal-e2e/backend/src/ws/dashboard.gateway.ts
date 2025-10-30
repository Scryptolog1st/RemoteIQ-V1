// backend/src/ws/dashboard.gateway.ts
import { Injectable, Logger } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server as WsServer, WebSocket, RawData } from "ws";

type UiSocket = WebSocket & {
    userId?: string;                 // TODO: populate from your WS auth later
    subscriptions?: Set<string>;     // deviceIds this socket wants updates for
};

type UiEvent =
    | { t: "device_checks_updated"; deviceId: string; changed: number; at: string }
    | { t: "hello"; ok: true };

type ClientMsg =
    | { t: "subscribe_device"; deviceId: string }
    | { t: "unsubscribe_device"; deviceId: string }
    | { t: "hello" };

function rawToString(data: RawData): string {
    if (typeof data === "string") return data;
    if (Buffer.isBuffer(data)) return data.toString("utf8");
    if (Array.isArray(data)) return Buffer.concat(data as Buffer[]).toString("utf8");
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
    return "";
}

/**
 * Dashboard (user) WebSocket endpoint.
 * - Path: /ws-dashboard
 * - Protocol:
 *     Client → { t: "hello" } (optional)
 *     Client → { t: "subscribe_device", deviceId }
 *     Client → { t: "unsubscribe_device", deviceId }
 *     Server → { t: "device_checks_updated", deviceId, changed, at }
 *
 * SECURITY: Add a WS auth guard/adaptor later to set socket.userId.
 */
@WebSocketGateway({ path: "/ws-dashboard" })
@Injectable()
export class DashboardGateway {
    private readonly log = new Logger("DashboardGateway");

    @WebSocketServer()
    private ws!: WsServer;

    /** deviceId → sockets subscribed to that device */
    private subscribers = new Map<string, Set<UiSocket>>();

    /** per-device debounce to coalesce bursts of inserts */
    private debounce = new Map<
        string,
        { timer: NodeJS.Timeout; changed: number; lastAt: string }
    >();

    /** Add a subscription mapping */
    private addSubscription(sock: UiSocket, deviceId: string) {
        if (!sock.subscriptions) sock.subscriptions = new Set();
        sock.subscriptions.add(deviceId);

        let set = this.subscribers.get(deviceId);
        if (!set) {
            set = new Set<UiSocket>();
            this.subscribers.set(deviceId, set);
        }
        set.add(sock);
    }

    /** Remove a subscription mapping */
    private removeSubscription(sock: UiSocket, deviceId: string) {
        sock.subscriptions?.delete(deviceId);
        const set = this.subscribers.get(deviceId);
        if (set) {
            set.delete(sock);
            if (set.size === 0) this.subscribers.delete(deviceId);
        }
    }

    /** Clean up all subscriptions on socket close */
    private cleanupSocket(sock: UiSocket) {
        if (sock.subscriptions) {
            for (const deviceId of sock.subscriptions) {
                const set = this.subscribers.get(deviceId);
                if (set) {
                    set.delete(sock);
                    if (set.size === 0) this.subscribers.delete(deviceId);
                }
            }
            sock.subscriptions.clear();
        }
    }

    /** Public API for services: coalesced notify */
    public notifyDeviceChecksUpdated(deviceId: string, changed: number = 1) {
        const nowIso = new Date().toISOString();

        // Debounce per device (500ms window)
        const prev = this.debounce.get(deviceId);
        if (prev) {
            prev.changed += Math.max(1, changed);
            prev.lastAt = nowIso;
            clearTimeout(prev.timer);
            prev.timer = setTimeout(() => {
                this.flushDevice(deviceId);
            }, 500);
        } else {
            const timer = setTimeout(() => this.flushDevice(deviceId), 500);
            this.debounce.set(deviceId, { timer, changed: Math.max(1, changed), lastAt: nowIso });
        }
    }

    /** Actually broadcast the event for a device to subscribed UI sockets */
    private flushDevice(deviceId: string) {
        const state = this.debounce.get(deviceId);
        if (!state) return;
        this.debounce.delete(deviceId);

        const payload: UiEvent = {
            t: "device_checks_updated",
            deviceId,
            changed: state.changed,
            at: state.lastAt,
        };

        const set = this.subscribers.get(deviceId);
        if (!set || set.size === 0) return;

        let sent = 0;
        for (const client of set) {
            if ((client as any).readyState !== (client as any).OPEN) continue;
            try {
                client.send(JSON.stringify(payload));
                sent++;
            } catch {
                /* ignore send errors */
            }
        }
        this.log.debug(`Broadcast device_checks_updated device=${deviceId} to ${sent} socket(s)`);
    }

    /** WS lifecycle + message handling */
    public afterInit() {
        if (!this.ws) {
            this.log.warn("WS server not initialized by adapter.");
            return;
        }

        this.ws.on("connection", (socket: UiSocket) => {
            // TODO: Attach auth-derived userId here if you have a WS auth guard/adapter
            socket.subscriptions = new Set();

            socket.on("message", (data: RawData) => {
                const text = rawToString(data);
                if (!text) return;
                let msg: ClientMsg | undefined;
                try {
                    msg = JSON.parse(text);
                } catch {
                    return;
                }
                if (!msg || typeof (msg as any).t !== "string") return;

                switch (msg.t) {
                    case "hello": {
                        const resp: UiEvent = { t: "hello", ok: true };
                        try { socket.send(JSON.stringify(resp)); } catch { /* ignore */ }
                        break;
                    }
                    case "subscribe_device": {
                        const did = String((msg as any).deviceId || "").trim();
                        if (!did) return;
                        this.addSubscription(socket, did);
                        break;
                    }
                    case "unsubscribe_device": {
                        const did = String((msg as any).deviceId || "").trim();
                        if (!did) return;
                        this.removeSubscription(socket, did);
                        break;
                    }
                }
            });

            socket.on("close", () => this.cleanupSocket(socket));
            socket.on("error", () => this.cleanupSocket(socket));
        });
    }
}
