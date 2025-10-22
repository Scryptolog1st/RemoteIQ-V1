// backend/src/branding/dto/update-branding.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, Matches } from 'class-validator';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export class UpdateBrandingDto {
    @ApiPropertyOptional({ example: '#3b82f6', description: 'Primary brand color (hex)' })
    @IsOptional()
    @IsString()
    @Matches(HEX, { message: 'primaryColor must be a valid hex like #1f2937 or #fff' })
    primaryColor?: string;

    @ApiPropertyOptional({ example: '#22c55e', description: 'Secondary brand color (hex)' })
    @IsOptional()
    @IsString()
    @Matches(HEX, { message: 'secondaryColor must be a valid hex like #22c55e or #0f0' })
    secondaryColor?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/logo-light.svg' })
    @IsOptional()
    @IsString()
    logoLightUrl?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/logo-dark.svg' })
    @IsOptional()
    @IsString()
    logoDarkUrl?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/login-bg.jpg' })
    @IsOptional()
    @IsString()
    loginBackgroundUrl?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/favicon.ico', description: 'Favicon (.ico) URL' })
    @IsOptional()
    @IsString()
    faviconUrl?: string;

    @ApiPropertyOptional({ description: 'HTML for email header' })
    @IsOptional()
    @IsString()
    emailHeader?: string;

    @ApiPropertyOptional({ description: 'HTML for email footer' })
    @IsOptional()
    @IsString()
    emailFooter?: string;

    @ApiPropertyOptional({ description: 'Raw CSS injected into app pages' })
    @IsOptional()
    @IsString()
    customCss?: string;

    @ApiPropertyOptional({ description: 'Allow end-users to toggle light/dark theme' })
    @IsOptional()
    @IsBoolean()
    allowClientThemeToggle?: boolean;
}
