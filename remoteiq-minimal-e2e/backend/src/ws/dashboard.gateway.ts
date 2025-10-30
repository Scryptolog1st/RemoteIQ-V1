// backend/src/ws/dashboard.gateway.ts
import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server as WsServer, WebSocket, RawData } from "ws";
import type { IncomingMessage } from "http";
import { JwtService } from "@nestjs/jwt";

import {
    UiSocketRegistry,
    type UiSocket,
} from "../common/ui-socket-registry.service";

/**
 * Minimal cookie parser (avoids external deps).
 */
function parseCookieHeader(h?: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!h) return out;
    for (const p of h.split(";")) {
        const i = p.indexOf("=");
        if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1));
    }
    return out;
}

/**
 * Safely stringify payloads for WS.
 */
function safeJson(data: unknown): string {
    try {
        return JSON.stringify(data);
    } catch {
        return "{}";
    }
}

/**
 * UI (dashboard) WebSocket gateway.
 * - Authenticates users by JWT cookie (same cookie as HTTP)
 * - Registers sockets into UiSocketRegistry
 * - Supports per-device subscriptions: {t:"subscribe", deviceId}, {t:"unsubscribe", deviceId}
 * - Heartbeat: {t:"ping"} -> {t:"pong"}
 *
 * NOTE: Remember to add DashboardGateway to WsModule.providers.
 */
@WebSocketGateway({ path: "/ws-ui" })
@Injectable()
export class DashboardGateway implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger("DashboardGateway");

    @WebSocketServer()
    private ws!: WsServer;

    private readonly cookieName =
        process.env.AUTH_COOKIE_NAME?.trim() || "auth_token";
    private readonly jwtSecret =
        process.env.JWT_SECRET?.trim() || "dev-secret"; // dev fallback

    constructor(
        private readonly uiSockets: UiSocketRegistry,
        private readonly jwt: JwtService
    ) { }

    onModuleInit() {
        if (!this.ws) {
            this.log.warn(
                "WS server not initialized by adapter; ensure a WS adapter is configured."
            );
            return;
        }

        this.ws.on(
            "connection",
            async (rawSocket: WebSocket, req: IncomingMessage) => {
                const socket = rawSocket as UiSocket;

                // ---- Authenticate user from cookie JWT ----
                const cookies = parseCookieHeader(
                    (req.headers && (req.headers as any).cookie) || ""
                );
                const token = cookies[this.cookieName];
                if (!token) {
                    this.closeWithPolicy(socket, 4401, "Missing auth cookie");
                    return;
                }

                let userId = "";
                try {
                    const payload: any = await this.jwt.verifyAsync(token, {
                        secret: this.jwtSecret,
                    });
                    // Expect standard fields from your login flow
                    userId = String(payload?.sub || payload?.id || "");
                    if (!userId) throw new Error("No sub in JWT");
                } catch (e: any) {
                    this.closeWithPolicy(
                        socket,
                        4401,
                        `Invalid auth token: ${e?.message || e}`
                    );
                    return;
                }

                // ---- Register socket ----
                try {
                    // Ensure subscriptions set exists for this socket
                    socket.subscriptions = socket.subscriptions ?? new Set<string>();
                    this.uiSockets.add(userId, socket);

                    // Ack the connection
                    socket.send(
                        safeJson({
                            t: "ack",
                            userId,
                            subscriptions: Array.from(socket.subscriptions),
                            totals: {
                                sockets: this.uiSockets.countAll(),
                                users: this.uiSockets.countUsers(),
                            },
                        })
                    );
                } catch (e: any) {
                    this.log.warn(
                        `Failed to register UI socket for user ${userId}: ${e?.message || e}`
                    );
                    this.closeWithPolicy(socket, 1011, "Registration failed");
                    return;
                }

                // ---- Message handling ----
                socket.on("message", (data: RawData) => {
                    const text = this.rawToString(data);
                    if (!text) return;

                    let msg: any;
                    try {
                        msg = JSON.parse(text);
                    } catch {
                        return;
                    }
                    const t: string = String(msg?.t || "");

                    // Ping/Pong
                    if (t === "ping") {
                        socket.send(safeJson({ t: "pong", at: new Date().toISOString() }));
                        return;
                    }

                    // Subscribe to a deviceId
                    if (t === "subscribe") {
                        const deviceId = String(msg?.deviceId || "").trim();
                        if (!deviceId) return;

                        try {
                            this.uiSockets.subscribe(socket, deviceId);
                            socket.send(
                                safeJson({
                                    t: "subscribed",
                                    deviceId,
                                    subscribers: this.uiSockets.countDeviceSubscribers(deviceId),
                                })
                            );
                        } catch (e: any) {
                            socket.send(
                                safeJson({
                                    t: "error",
                                    error: "subscribe_failed",
                                    message: e?.message || String(e),
                                })
                            );
                        }
                        return;
                    }

                    // Unsubscribe from a deviceId
                    if (t === "unsubscribe") {
                        const deviceId = String(msg?.deviceId || "").trim();
                        if (!deviceId) return;

                        try {
                            this.uiSockets.unsubscribe(socket, deviceId);
                            socket.send(
                                safeJson({
                                    t: "unsubscribed",
                                    deviceId,
                                    subscribers: this.uiSockets.countDeviceSubscribers(deviceId),
                                })
                            );
                        } catch (e: any) {
                            socket.send(
                                safeJson({
                                    t: "error",
                                    error: "unsubscribe_failed",
                                    message: e?.message || String(e),
                                })
                            );
                        }
                        return;
                    }

                    // Unknown message type — ignore silently or send error
                });

                // ---- Cleanup on close/error ----
                const cleanup = () => {
                    try {
                        this.uiSockets.remove(socket);
                    } catch {
                        /* ignore */
                    }
                };
                socket.on("close", cleanup);
                socket.on("error", cleanup);
            }
        );
    }

    onModuleDestroy() {
        try {
            this.ws?.close();
        } catch {
            /* ignore */
        }
    }

    /* ------------------------------- Helpers -------------------------------- */

    private rawToString(data: RawData): string {
        if (typeof data === "string") return data;
        if (Buffer.isBuffer(data)) return data.toString("utf8");
        if (Array.isArray(data))
            return Buffer.concat(data as Buffer[]).toString("utf8");
        if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
        return "";
    }

    private closeWithPolicy(ws: WebSocket, code: number, reason: string) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (ws as any).close?.(code, reason);
        } catch {
            /* ignore */
        }
    }
}
