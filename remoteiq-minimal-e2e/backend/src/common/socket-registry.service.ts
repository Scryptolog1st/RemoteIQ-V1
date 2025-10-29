import { Injectable } from "@nestjs/common";
import type { WebSocket } from "ws";

export type AgentSocket = WebSocket & {
    agentId?: string;
    deviceId?: string;
};

@Injectable()
export class SocketRegistry {
    private socketsByAgent = new Map<string, AgentSocket>();
    private socketsByDevice = new Map<string, AgentSocket>();

    // --- Primary API ---
    getByAgent(agentId: string): AgentSocket | undefined {
        return this.socketsByAgent.get(agentId);
    }

    getByDevice(deviceId: string): AgentSocket | undefined {
        return this.socketsByDevice.get(deviceId);
    }

    set(agentId: string | undefined, deviceId: string | undefined, socket: AgentSocket) {
        if (agentId) {
            this.socketsByAgent.set(agentId, socket);
            socket.agentId = agentId;
        }
        if (deviceId) {
            this.socketsByDevice.set(deviceId, socket);
            socket.deviceId = deviceId;
        }
    }

    deleteByAgent(agentId: string) {
        const sock = this.socketsByAgent.get(agentId);
        if (sock?.deviceId) this.socketsByDevice.delete(sock.deviceId);
        this.socketsByAgent.delete(agentId);
    }

    deleteByDevice(deviceId: string) {
        const sock = this.socketsByDevice.get(deviceId);
        if (sock?.agentId) this.socketsByAgent.delete(sock.agentId);
        this.socketsByDevice.delete(deviceId);
    }

    // --- Back-compat aliases (so older callers like dispatcher.service can keep using .get) ---
    /** Alias for getByAgent */
    get(agentId: string): AgentSocket | undefined {
        return this.getByAgent(agentId);
    }
    /** Aliases in case other code uses these names */
    setByAgent(agentId: string, socket: AgentSocket) {
        this.set(agentId, /*deviceId*/ undefined, socket);
    }
    setByDevice(deviceId: string, socket: AgentSocket) {
        this.set(/*agentId*/ undefined, deviceId, socket);
    }
}
