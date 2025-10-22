CREATE TABLE IF NOT EXISTS support_legal_settings (
    id integer PRIMARY KEY,
    support_url text,
    status_url text,
    terms_url text,
    privacy_url text,
    kb_url text,
    contact_email text,
    support_phone text,
    legal_version text
);

INSERT INTO
    support_legal_settings (id)
SELECT
    1
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            support_legal_settings
        WHERE
            id = 1
    );