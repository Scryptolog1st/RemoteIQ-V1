// backend/src/ws/ws.gateway.ts
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "ws";

@WebSocketGateway({ path: "/ws" })
export class WsGateway {
    @WebSocketServer() server!: Server;

    broadcast(payload: any) {
        const data = JSON.stringify(payload);
        this.server?.clients?.forEach((client: any) => {
            try {
                if (client?.readyState === 1 /* OPEN */) client.send(data);
            } catch { }
        });
    }
}
