// backend/src/ws/agent.gateway.ts
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "ws";

/**
 * Shared WebSocket gateway for agent <-> server <-> UI realtime.
 * We expose a simple `broadcast(payload)` helper the rest of the app can use.
 */
@WebSocketGateway({ path: "/ws" })
export class AgentGateway {
  @WebSocketServer() server!: Server;

  broadcast(payload: any) {
    const data = JSON.stringify(payload);
    if (!this.server) return;
    this.server.clients.forEach((client: any) => {
      try {
        if (client?.readyState === 1 /* OPEN */) client.send(data);
      } catch {
        // ignore send errors
      }
    });
  }
}
