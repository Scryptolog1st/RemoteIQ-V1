// backend/src/checks/checks.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { ChecksService } from './checks.service';
import { ChecksController, DeviceChecksController } from './checks.controller';
import { StorageModule } from '../storage/storage.module';
import { CommonModule } from '../common/common.module'; // <-- add
import { WsModule } from '../ws/ws.module';             // (optional, only if you also use DashboardGateway)

@Module({
    imports: [
        StorageModule,
        CommonModule,               // <-- needed for UiSocketRegistry
        forwardRef(() => WsModule), // ok to keep if you’re also using DashboardGateway elsewhere
    ],
    controllers: [ChecksController, DeviceChecksController],
    providers: [ChecksService],
    exports: [ChecksService],
})
export class ChecksModule { }
