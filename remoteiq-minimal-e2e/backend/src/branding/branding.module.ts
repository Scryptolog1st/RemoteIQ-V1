// src/branding/branding.module.ts
import { Module } from '@nestjs/common';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';

@Module({
    controllers: [BrandingController],
    providers: [BrandingService],
    exports: [BrandingService],
})
export class BrandingModule { }
