import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
    imports: [StorageModule],
    providers: [RolesService],
    controllers: [RolesController],
    exports: [RolesService],
})
export class RolesModule { }
