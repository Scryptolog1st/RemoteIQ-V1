-- ======================================================================
-- roles companion metadata (non-breaking, keeps your current model)
--   - Adds role_meta table keyed to roles.name
--   - Stores description, permissions (text[]), updated_at
--   - Adds trigger to auto-bump updated_at on UPDATE
--   - Creates a convenience VIEW for listing with users_count
-- ======================================================================

BEGIN;

-- 1) role_meta table (companion to roles)
CREATE TABLE IF NOT EXISTS public.role_meta (
  role_name   text PRIMARY KEY,
  description text,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_role_meta_role
    FOREIGN KEY (role_name)
    REFERENCES public.roles(name)
    ON DELETE CASCADE
);

-- 2) Update timestamp trigger for role_meta
CREATE OR REPLACE FUNCTION public.role_meta_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_meta_touch_updated_at ON public.role_meta;
CREATE TRIGGER trg_role_meta_touch_updated_at
BEFORE UPDATE ON public.role_meta
FOR EACH ROW
EXECUTE FUNCTION public.role_meta_touch_updated_at();

-- 3) Helpful index for case-insensitive joins/lookups (optional but handy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
      AND  indexname  = 'idx_role_meta_lower_name'
  ) THEN
    EXECUTE 'CREATE INDEX idx_role_meta_lower_name
             ON public.role_meta (lower(role_name))';
  END IF;
END;
$$;

-- 4) View that your API can SELECT from to satisfy the RolesTab shape
--    - users_count derived from users.role (TEXT) against role name
--    - updated_at prefers meta.updated_at else roles.created_at
CREATE OR REPLACE VIEW public.roles_with_meta AS
SELECT
  r.id,
  r.name,
  COALESCE(rm.description, '')           AS description,
  COALESCE(rm.permissions, '{}')         AS permissions,
  COALESCE(rm.updated_at, r.created_at)  AS updated_at,
  r.created_at,
  (
    SELECT COUNT(*)::int
    FROM public.users u
    WHERE lower(u.role) = lower(r.name)
  ) AS users_count
FROM public.roles r
LEFT JOIN public.role_meta rm
  ON rm.role_name = r.name;

-- 5) Seed role_meta rows for existing roles (no-op if already present)
INSERT INTO public.role_meta (role_name, description, permissions)
SELECT r.name,
       CASE lower(r.name)
         WHEN 'owner' THEN 'Full system access'
         WHEN 'admin' THEN 'Administrative access'
         ELSE 'Standard access'
       END,
       CASE lower(r.name)
         WHEN 'owner' THEN ARRAY[
           'users.read','users.write','users.delete','users.2fa.reset',
           'roles.read','roles.write','roles.delete',
           'teams.read','teams.write','teams.delete',
           'billing.read','billing.write',
           'settings.read','settings.write'
         ]::text[]
         WHEN 'admin' THEN ARRAY[
           'users.read','users.write','users.2fa.reset',
           'roles.read','roles.write',
           'teams.read','teams.write',
           'billing.read',
           'settings.read','settings.write'
         ]::text[]
         ELSE ARRAY['users.read','roles.read','teams.read','settings.read']::text[]
       END
FROM public.roles r
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_meta rm WHERE rm.role_name = r.name
);

COMMIT;
