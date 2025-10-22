-- Ensure pgcrypto (for gen_random_uuid) is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Normalize id to uuid (handle empty-string -> NULL), then set default
ALTER TABLE
    users
ALTER COLUMN
    id
SET
    DATA TYPE uuid USING NULLIF(id :: text, '') :: uuid;

ALTER TABLE
    users
ALTER COLUMN
    id
SET
    DEFAULT gen_random_uuid();

-- Add PRIMARY KEY on id if it doesn't already exist (no $$, no backslashes)
DO LANGUAGE plpgsql '
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conrelid = ''public.users''::regclass
    AND    contype  = ''p''
  ) THEN
    EXECUTE ''ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id)'';
  END IF;
END';

-- Add UNIQUE(email) if it doesn't already exist (no $$, no backslashes)
DO LANGUAGE plpgsql '
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conrelid = ''public.users''::regclass
    AND    contype  = ''u''
    AND    conname  = ''users_email_key''
  ) THEN
    EXECUTE ''ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email)'';
  END IF;
END';

-- Backfill any NULL ids (should be rare after the USING cast)
UPDATE
    users
SET
    id = gen_random_uuid()
WHERE
    id IS NULL;