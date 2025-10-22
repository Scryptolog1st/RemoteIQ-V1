-- migrations/XXXX_add_users_roles.sql
-- Users & Roles schema (idempotent)
-- Needed for gen_random_uuid() in some Postgres setups
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------
-- roles
-- -----------------------------
CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text
);

-- Seed common roles (no duplicates)
INSERT INTO
    roles (name, description)
VALUES
    (
        'Owner',
        'Full access to all organization settings and data'
    ),
    (
        'Admin',
        'Manage users, settings, billing; full device access'
    ),
    ('User', 'Standard access') ON CONFLICT (name) DO NOTHING;

-- -----------------------------
-- users
-- -----------------------------
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    role text NOT NULL DEFAULT 'User',
    status text NOT NULL DEFAULT 'active',
    -- 'active' | 'suspended'
    two_factor_enabled boolean NOT NULL DEFAULT false,
    last_seen timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- -----------------------------
-- updated_at trigger
-- -----------------------------
CREATE
OR REPLACE FUNCTION set_users_updated_at() RETURNS trigger LANGUAGE plpgsql AS $ func $ BEGIN NEW.updated_at := now();

RETURN NEW;

END $ func $;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

CREATE TRIGGER trg_users_updated_at BEFORE
UPDATE
    ON users FOR EACH ROW EXECUTE FUNCTION set_users_updated_at();

-- -----------------------------
-- Optional: seed a demo user if you want (email must be unique).
-- Comment out if you don't want any seed user here.
-- -----------------------------
INSERT INTO
    users (name, email, role, status, two_factor_enabled)
SELECT
    'Demo User',
    'demo@example.com',
    'User',
    'active',
    false
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            users
        WHERE
            email = 'demo@example.com'
    );