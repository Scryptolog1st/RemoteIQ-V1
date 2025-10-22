// backend/src/branding/branding.service.ts
import { Injectable, OnModuleDestroy, InternalServerErrorException } from '@nestjs/common';
import { UpdateBrandingDto } from './dto/update-branding.dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Pool } = require('pg');

type BrandingRow = {
    primary_color: string | null;
    secondary_color: string | null;
    logo_light_url: string | null;
    logo_dark_url: string | null;
    login_background_url: string | null;
    favicon_url: string | null;
    email_header: string | null;
    email_footer: string | null;
    custom_css: string | null;
    allow_client_theme_toggle: boolean | null;
};

@Injectable()
export class BrandingService implements OnModuleDestroy {
    private pool: any;

    constructor() {
        const connectionString = process.env.DATABASE_URL;
        if (connectionString) {
            this.pool = new Pool({
                connectionString,
                ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
            });
        } else {
            this.pool = new Pool({
                host: process.env.PGHOST ?? 'localhost',
                port: Number(process.env.PGPORT ?? 5432),
                user: process.env.PGUSER ?? 'postgres',
                password: process.env.PGPASSWORD ?? undefined,
                database: process.env.PGDATABASE ?? 'remoteiq',
                ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
            });
        }
    }

    async onModuleDestroy() {
        try {
            await this.pool.end();
        } catch {
            /* no-op */
        }
    }

    private rowToApi(row: BrandingRow) {
        return {
            primaryColor: row?.primary_color ?? null,
            secondaryColor: row?.secondary_color ?? null,
            logoLightUrl: row?.logo_light_url ?? null,
            logoDarkUrl: row?.logo_dark_url ?? null,
            loginBackgroundUrl: row?.login_background_url ?? null,
            faviconUrl: row?.favicon_url ?? null,
            emailHeader: row?.email_header ?? null,
            emailFooter: row?.email_footer ?? null,
            customCss: row?.custom_css ?? null,
            allowClientThemeToggle: row?.allow_client_theme_toggle ?? null,
        };
    }

    async getBranding() {
        try {
            const sql = `
        SELECT primary_color, secondary_color,
               logo_light_url, logo_dark_url, login_background_url, favicon_url,
               email_header, email_footer, custom_css, allow_client_theme_toggle
        FROM branding_settings
        ORDER BY id DESC
        LIMIT 1
      `;
            const res = await this.pool.query(sql);
            const rows = (res?.rows ?? []) as BrandingRow[];
            const row = rows[0];
            if (!row) {
                return {
                    primaryColor: null,
                    secondaryColor: null,
                    logoLightUrl: null,
                    logoDarkUrl: null,
                    loginBackgroundUrl: null,
                    faviconUrl: null,
                    emailHeader: null,
                    emailFooter: null,
                    customCss: null,
                    allowClientThemeToggle: null,
                };
            }
            return this.rowToApi(row);
        } catch (err: any) {
            throw new InternalServerErrorException(`Failed to load branding: ${err?.message ?? err}`);
        }
    }

    async updateBranding(input: UpdateBrandingDto) {
        try {
            const sql = `
        INSERT INTO branding_settings
          (id, primary_color, secondary_color, logo_light_url, logo_dark_url, login_background_url, favicon_url,
           email_header, email_footer, custom_css, allow_client_theme_toggle)
        VALUES
          (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          logo_light_url = EXCLUDED.logo_light_url,
          logo_dark_url = EXCLUDED.logo_dark_url,
          login_background_url = EXCLUDED.login_background_url,
          favicon_url = EXCLUDED.favicon_url,
          email_header = EXCLUDED.email_header,
          email_footer = EXCLUDED.email_footer,
          custom_css = EXCLUDED.custom_css,
          allow_client_theme_toggle = EXCLUDED.allow_client_theme_toggle
      `;
            const values = [
                input.primaryColor ?? null,
                input.secondaryColor ?? null,
                input.logoLightUrl ?? null,
                input.logoDarkUrl ?? null,
                input.loginBackgroundUrl ?? null,
                input.faviconUrl ?? null,
                input.emailHeader ?? null,
                input.emailFooter ?? null,
                input.customCss ?? null,
                input.allowClientThemeToggle ?? null,
            ];

            await this.pool.query(sql, values);
            return this.getBranding();
        } catch (err: any) {
            throw new InternalServerErrorException(`Failed to update branding: ${err?.message ?? err}`);
        }
    }
}
