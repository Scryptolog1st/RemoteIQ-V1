//remoteiq-minimal-e2e\backend\src\checks\checks.module.ts

import { Module } from '@nestjs/common';
import { ChecksService } from './checks.service';
import { ChecksController, DeviceChecksController } from './checks.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [StorageModule],
    controllers: [ChecksController, DeviceChecksController],
    providers: [ChecksService],
    exports: [ChecksService],
})
export class ChecksModule { }
