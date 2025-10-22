import { IsIn, IsOptional, IsString } from "class-validator";

export class LocalizationDto {
    // e.g., "en-US", "fr-FR"
    @IsString()
    language!: string;

    // e.g., "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"
    @IsString()
    dateFormat!: string;

    // e.g., "h:mm a", "HH:mm"
    @IsString()
    timeFormat!: string;

    // e.g., "1,234.56", "1.234,56"
    @IsString()
    numberFormat!: string;

    // IANA TZ like "America/New_York"
    @IsString()
    timeZone!: string;

    // first day of week
    @IsIn(["sunday", "monday"])
    firstDayOfWeek!: "sunday" | "monday";

    // Optional currency (future-proofing)
    @IsOptional()
    @IsString()
    currency?: string;
}

export type LocalizationRow = LocalizationDto & { id: 1 };
