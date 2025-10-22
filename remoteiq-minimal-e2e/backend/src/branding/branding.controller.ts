// backend/src/branding/branding.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
    Req,
} from '@nestjs/common';
import { ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import type { Request } from 'express';

import { BrandingService } from './branding.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@ApiTags('branding')
@Controller('api/branding')
export class BrandingController {
    constructor(private readonly service: BrandingService) { }

    /* ------------------------------------------------------------------ */
    /* Read / Write settings                                               */
    /* ------------------------------------------------------------------ */

    @Get()
    @ApiOkResponse({ description: 'Current branding settings' })
    getBranding() {
        return this.service.getBranding();
    }

    @Post()
    @ApiOkResponse({ description: 'Updated branding settings' })
    updateBranding(@Body() dto: UpdateBrandingDto) {
        return this.service.updateBranding(dto);
    }

    /* ------------------------------------------------------------------ */
    /* Uploads                                                             */
    /* - General images (logos, backgrounds) -> /api/branding/upload       */
    /* - Favicon (.ico only)             -> /api/branding/upload-favicon   */
    /* Files are written to ./public/uploads and served at /static/uploads */
    /* ------------------------------------------------------------------ */

    /** Upload general image (logos, login backgrounds). Field name: `file` */
    @Post('upload')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (_req, _file, cb) => {
                    const dest = join(process.cwd(), 'public', 'uploads');
                    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
                    cb(null, dest);
                },
                filename: (_req, file, cb) => {
                    const ts = Date.now();
                    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
                    cb(null, `${ts}_${safe}`);
                },
            }),
            fileFilter: (_req, file, cb) => {
                if (!/^image\//.test(file.mimetype)) {
                    return cb(new BadRequestException('Only image files are allowed'), false);
                }
                cb(null, true);
            },
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
        }),
    )
    uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
        if (!file) throw new BadRequestException('No file uploaded');

        const base =
            process.env.PUBLIC_BASE_URL ||
            `${req.protocol}://${req.get('host')}`;

        // NOTE: main.ts must call app.useStaticAssets(..., { prefix: '/static/' })
        return { url: `${base}/static/uploads/${file.filename}` };
    }

    /** Upload favicon (.ico only). Field name: `file` */
    @Post('upload-favicon')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (_req, _file, cb) => {
                    const dest = join(process.cwd(), 'public', 'uploads');
                    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
                    cb(null, dest);
                },
                filename: (_req, file, cb) => {
                    const ts = Date.now();
                    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
                    cb(null, `${ts}_${safe}`);
                },
            }),
            fileFilter: (_req, file, cb) => {
                const isIco =
                    file.mimetype === 'image/x-icon' ||
                    file.mimetype === 'image/vnd.microsoft.icon' ||
                    extname(file.originalname).toLowerCase() === '.ico';
                if (!isIco) {
                    return cb(new BadRequestException('Only .ico files are allowed'), false);
                }
                cb(null, true);
            },
            limits: { fileSize: 512 * 1024 }, // 512KB
        }),
    )
    uploadFavicon(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
        if (!file) throw new BadRequestException('No file uploaded');

        const base =
            process.env.PUBLIC_BASE_URL ||
            `${req.protocol}://${req.get('host')}`;

        return { url: `${base}/static/uploads/${file.filename}` };
    }
}
