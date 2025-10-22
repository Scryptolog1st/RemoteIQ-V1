-- Adds password fields to users for admin-created users & manual resets
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE
    users
ADD
    COLUMN IF NOT EXISTS password_hash text,
ADD
    COLUMN IF NOT EXISTS password_updated_at timestamptz;

-- (Optional) if you want invited users to be default 'invited' not 'active'
ALTER TABLE
    users
ALTER COLUMN
    status
SET
    DEFAULT 'active';