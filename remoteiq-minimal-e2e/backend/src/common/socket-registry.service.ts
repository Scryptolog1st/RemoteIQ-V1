import { Injectable } from "@nestjs/common";
import type { WebSocket } from "ws";

export type AgentSocket = WebSocket & { agentId?: string };

@Injectable()
export class SocketRegistry {
    private socketsByAgent = new Map<string, AgentSocket>();

    get(agentId: string): AgentSocket | undefined {
        return this.socketsByAgent.get(agentId);
    }
    set(agentId: string, socket: AgentSocket) {
        this.socketsByAgent.set(agentId, socket);
    }
    delete(agentId: string) {
        this.socketsByAgent.delete(agentId);
    }
}
