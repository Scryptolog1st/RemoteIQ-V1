// backend/src/branding/branding.module.ts
import { Module } from '@nestjs/common';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';
// If you switch BrandingService to use PgPoolService, also:
// import { StorageModule } from '../storage/storage.module';

@Module({
    // imports: [StorageModule], // <- only if BrandingService uses PgPoolService
    controllers: [BrandingController],
    providers: [BrandingService],
    exports: [BrandingService],
})
export class BrandingModule { }
