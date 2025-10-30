// backend/src/common/common.module.ts
import { Module } from '@nestjs/common';
import { SocketRegistry } from './socket-registry.service';
import { UiSocketRegistry } from './ui-socket-registry.service';
import { AgentTokenGuard } from './agent-token.util';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [StorageModule],
    providers: [SocketRegistry, UiSocketRegistry, AgentTokenGuard],
    exports: [SocketRegistry, UiSocketRegistry, AgentTokenGuard],
})
export class CommonModule { }
