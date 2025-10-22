import { Module } from "@nestjs/common";
import { SocketRegistry } from "./socket-registry.service";

@Module({
    providers: [SocketRegistry],
    exports: [SocketRegistry],
})
export class CommonModule { }
