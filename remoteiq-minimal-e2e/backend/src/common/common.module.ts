// remoteiq-minimal-e2e/backend/src/common/common.module.ts
import { Module } from '@nestjs/common';
import { SocketRegistry } from './socket-registry.service';
import { AgentTokenGuard } from './agent-token.util';
import { StorageModule } from '../storage/storage.module'; // Guard needs PgPoolService

@Module({
    imports: [StorageModule],
    providers: [SocketRegistry, AgentTokenGuard],
    exports: [SocketRegistry, AgentTokenGuard],
})
export class CommonModule { }
