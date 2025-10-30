import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [StorageModule],
    controllers: [AlertsController],
    providers: [AlertsService],
    exports: [AlertsService],
})
export class AlertsModule { }
