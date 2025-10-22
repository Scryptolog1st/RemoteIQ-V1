BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);
INSERT INTO roles (name) VALUES ('Admin') ON CONFLICT DO NOTHING;
INSERT INTO roles (name) VALUES ('User')  ON CONFLICT DO NOTHING;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  email               text        NOT NULL UNIQUE,
  role                text        NOT NULL DEFAULT 'User',
  status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','invited')),
  two_factor_enabled  boolean     NOT NULL DEFAULT false,
  last_seen           timestamptz NULL,
  password_hash       text        NULL,
  password_updated_at timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role                text        NOT NULL DEFAULT 'User',
  ADD COLUMN IF NOT EXISTS status              text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS two_factor_enabled  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen           timestamptz NULL,
  ADD COLUMN IF NOT EXISTS password_hash       text        NULL,
  ADD COLUMN IF NOT EXISTS password_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_at          timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- Use a named tag to avoid PowerShell mangling $$ into "$ $"
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_status_check'
  ) THEN
    EXECUTE
      'ALTER TABLE users
         ADD CONSTRAINT users_status_check
         CHECK (status IN (''active'',''suspended'',''invited''))';
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_role        ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status      ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users ((lower(email)));
CREATE INDEX IF NOT EXISTS idx_users_lower_name  ON users ((lower(name)));

COMMIT;
