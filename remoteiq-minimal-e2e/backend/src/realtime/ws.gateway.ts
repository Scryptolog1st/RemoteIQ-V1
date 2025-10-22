// src/realtime/ws.gateway.ts
import {
    WebSocketGateway, WebSocketServer, OnGatewayInit,
} from "@nestjs/websockets";
import { Server } from "ws";

@WebSocketGateway({ path: "/ws" })
export class WsGateway implements OnGatewayInit {
    @WebSocketServer() server!: Server;

    afterInit() {
        // no-op; ready to broadcast
    }

    broadcast(payload: any) {
        const data = JSON.stringify(payload);
        this.server?.clients?.forEach((client: any) => {
            try {
                if (client?.readyState === 1 /* OPEN */) client.send(data);
            } catch (_) { }
        });
    }
}
