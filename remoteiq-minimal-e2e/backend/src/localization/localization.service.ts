import { Injectable } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import { LocalizationDto, LocalizationRow } from "./localization.dto";

@Injectable()
export class LocalizationService {
    private readonly rowId = 1;
    constructor(private readonly pg: PgPoolService) { }

    async get(): Promise<LocalizationRow | null> {
        const { rows } = await this.pg.query(
            `SELECT 1 AS id,
              language,
              date_format AS "dateFormat",
              time_format AS "timeFormat",
              number_format AS "numberFormat",
              time_zone AS "timeZone",
              first_day_of_week AS "firstDayOfWeek",
              currency
         FROM localization_settings
        WHERE id = $1
        LIMIT 1`,
            [this.rowId]
        );
        return rows[0] ?? null;
    }

    async upsert(input: LocalizationDto): Promise<void> {
        await this.pg.query(
            `INSERT INTO localization_settings
         (id, language, date_format, time_format, number_format, time_zone, first_day_of_week, currency)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         language          = EXCLUDED.language,
         date_format       = EXCLUDED.date_format,
         time_format       = EXCLUDED.time_format,
         number_format     = EXCLUDED.number_format,
         time_zone         = EXCLUDED.time_zone,
         first_day_of_week = EXCLUDED.first_day_of_week,
         currency          = EXCLUDED.currency`,
            [
                this.rowId,
                input.language,
                input.dateFormat,
                input.timeFormat,
                input.numberFormat,
                input.timeZone,
                input.firstDayOfWeek,
                input.currency ?? null,
            ]
        );
    }
}
