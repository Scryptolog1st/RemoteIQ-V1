-- Minimal, single-row table for localization settings.
CREATE TABLE IF NOT EXISTS localization_settings (
    id integer PRIMARY KEY,
    language text NOT NULL,
    -- e.g., en-US
    date_format text NOT NULL,
    -- e.g., MM/DD/YYYY
    time_format text NOT NULL,
    -- e.g., h:mm a
    number_format text NOT NULL,
    -- e.g., 1,234.56
    time_zone text NOT NULL,
    -- IANA TZ
    first_day_of_week text NOT NULL,
    -- 'sunday' | 'monday'
    currency text -- optional, e.g., USD, EUR
);

-- Seed a single row if absent (id = 1).
INSERT INTO
    localization_settings (
        id,
        language,
        date_format,
        time_format,
        number_format,
        time_zone,
        first_day_of_week,
        currency
    )
SELECT
    1,
    'en-US',
    'MM/DD/YYYY',
    'h:mm a',
    '1,234.56',
    'America/New_York',
    'sunday',
    'USD'
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            localization_settings
        WHERE
            id = 1
    );