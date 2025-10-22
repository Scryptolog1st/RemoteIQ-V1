/*
 KEEP CURRENT MODEL (users.role is TEXT)
 
 This migration:
 - Ensures pgcrypto is available (for gen_random_uuid if you ever need it)
 - Enhances roles table (description, permissions text[], updated_at)
 - Adds case-insensitive unique index on roles.name
 - Adds a generic "updated_at" trigger and enables it for tables that already have an updated_at column
 (roles, users, support_legal_settings, branding_settings)
 - Adds a helpful index on lower(users.role) for faster role counts
 - Seeds Owner/Admin/User roles if missing (safe, idempotent)
 - Creates roles_with_counts view (used by API to return usersCount)
 */
-- 0) Extension (safe / idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) ROLES: add columns if missing
DO $ $ BEGIN IF NOT EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = 'roles'
        AND column_name = 'description'
) THEN
ALTER TABLE
    public.roles
ADD
    COLUMN description text;

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = 'roles'
        AND column_name = 'permissions'
) THEN
ALTER TABLE
    public.roles
ADD
    COLUMN permissions text [] NOT NULL DEFAULT ARRAY [] :: text [];

END IF;

IF NOT EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = 'roles'
        AND column_name = 'updated_at'
) THEN
ALTER TABLE
    public.roles
ADD
    COLUMN updated_at timestamptz NOT NULL DEFAULT now();

END IF;

END $ $;

-- 2) ROLES: case-insensitive uniqueness on name (keeps your existing unique on name too)
CREATE UNIQUE INDEX IF NOT EXISTS roles_name_lower_key ON public.roles (lower(name));

-- 3) Generic updated_at trigger function (reused by several tables)
DO $ $ BEGIN IF NOT EXISTS (
    SELECT
        1
    FROM
        pg_proc
    WHERE
        proname = 'set_updated_at_now'
) THEN CREATE
OR REPLACE FUNCTION public.set_updated_at_now() RETURNS trigger LANGUAGE plpgsql AS $ fn $ BEGIN NEW.updated_at := now();

RETURN NEW;

END;

$ fn $;

END IF;

END $ $;

-- 4) Attach updated_at triggers for tables that already have updated_at
--    (safe: checks existence before creating)
DO $ $ BEGIN -- roles
IF EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = 'roles'
        AND column_name = 'updated_at'
)
AND NOT EXISTS (
    SELECT
        1
    FROM
        pg_trigger
    WHERE
        tgname = 'trg_roles_set_updated_at'
) THEN CREATE TRIGGER trg_roles_set_updated_at BEFORE
UPDATE
    ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

END IF;

-- users
IF EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'updated_at'
)
AND NOT EXISTS (
    SELECT
        1
    FROM
        pg_trigger
    WHERE
        tgname = 'trg_users_set_updated_at'
) THEN CREATE TRIGGER trg_users_set_updated_at BEFORE
UPDATE
    ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

END IF;

-- support_legal_settings
IF EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = 'support_legal_settings'
        AND column_name = 'updated_at'
)
AND NOT EXISTS (
    SELECT
        1
    FROM
        pg_trigger
    WHERE
        tgname = 'trg_support_legal_settings_set_updated_at'
) THEN CREATE TRIGGER trg_support_legal_settings_set_updated_at BEFORE
UPDATE
    ON public.support_legal_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

END IF;

-- branding_settings
IF EXISTS (
    SELECT
        1
    FROM
        information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = 'branding_settings'
        AND column_name = 'updated_at'
)
AND NOT EXISTS (
    SELECT
        1
    FROM
        pg_trigger
    WHERE
        tgname = 'trg_branding_settings_set_updated_at'
) THEN CREATE TRIGGER trg_branding_settings_set_updated_at BEFORE
UPDATE
    ON public.branding_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

END IF;

END $ $;

-- 5) Helpful performance index for role counts
CREATE INDEX IF NOT EXISTS idx_users_lower_role ON public.users (lower(role));

-- 6) Seed common roles if missing (safe/idempotent; keeps your current model)
INSERT INTO
    public.roles (name, description, permissions)
SELECT
    r.name,
    r.description,
    r.permissions
FROM
    (
        VALUES
            (
                'Owner',
                'System owner',
                ARRAY [
    'users.read','users.write','users.delete','users.2fa.reset',
    'roles.read','roles.write','roles.delete',
    'teams.read','teams.write','teams.delete',
    'billing.read','billing.write',
    'settings.read','settings.write'
  ] :: text []
            ),
            (
                'Admin',
                'Administrator',
                ARRAY [
    'users.read','users.write','users.2fa.reset',
    'roles.read','roles.write',
    'teams.read','teams.write',
    'billing.read',
    'settings.read','settings.write'
  ] :: text []
            ),
            (
                'User',
                'Standard user',
                ARRAY [
    'users.read','roles.read','teams.read','billing.read','settings.read'
  ] :: text []
            )
    ) AS r(name, description, permissions)
WHERE
    NOT EXISTS (
        SELECT
            1
        FROM
            public.roles x
        WHERE
            lower(x.name) = lower(r.name)
    );

-- 7) View that your API can read directly to provide usersCount in one call
CREATE
OR REPLACE VIEW public.roles_with_counts AS
SELECT
    ro.id,
    ro.name,
    ro.description,
    ro.permissions,
    ro.created_at,
    ro.updated_at,
    COALESCE(u.cnt, 0) :: int AS users_count
FROM
    public.roles ro
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) AS cnt
        FROM
            public.users u
        WHERE
            lower(u.role) = lower(ro.name)
    ) u ON TRUE;