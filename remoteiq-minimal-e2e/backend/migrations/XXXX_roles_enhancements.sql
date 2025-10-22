-- === Add missing columns on roles (idempotent) ===
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='roles' AND column_name='description'
  ) THEN
    ALTER TABLE public.roles ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='roles' AND column_name='permissions'
  ) THEN
    -- string[] to match your frontend
    ALTER TABLE public.roles ADD COLUMN permissions text[] NOT NULL DEFAULT ARRAY[]::text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='roles' AND column_name='updated_at'
  ) THEN
    ALTER TABLE public.roles ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END$$;

-- === Case-insensitive unique constraint on roles.name ===
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM   pg_indexes 
    WHERE  schemaname='public' AND tablename='roles' AND indexname='roles_name_lower_key'
  ) THEN
    CREATE UNIQUE INDEX roles_name_lower_key ON public.roles (lower(name));
  END IF;
END$$;

-- === Trigger to keep updated_at fresh ===
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'roles_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION roles_set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_roles_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_roles_set_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION roles_set_updated_at();
  END IF;
END$$;

-- === (Optional) Seed common roles if missing ===
INSERT INTO public.roles (name, description, permissions)
SELECT r.name, r.description, r.permissions
FROM (VALUES
  ('Owner', 'System owner', ARRAY[
    'users.read','users.write','users.delete','users.2fa.reset',
    'roles.read','roles.write','roles.delete',
    'teams.read','teams.write','teams.delete',
    'billing.read','billing.write',
    'settings.read','settings.write'
  ]::text[]),
  ('Admin', 'Administrator', ARRAY[
    'users.read','users.write','users.2fa.reset',
    'roles.read','roles.write',
    'teams.read','teams.write',
    'billing.read',
    'settings.read','settings.write'
  ]::text[]),
  ('User', 'Standard user', ARRAY[
    'users.read','roles.read','teams.read','billing.read','settings.read'
  ]::text[])
) AS r(name, description, permissions)
WHERE NOT EXISTS (SELECT 1 FROM public.roles x WHERE lower(x.name)=lower(r.name));

-- === Convenience view for fast list with counts ===
CREATE OR REPLACE VIEW public.roles_with_counts AS
SELECT
  ro.id,
  ro.name,
  ro.description,
  ro.permissions,
  ro.created_at,
  ro.updated_at,
  COALESCE(u.cnt, 0)::int AS users_count
FROM public.roles ro
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM public.users u
  WHERE lower(u.role) = lower(ro.name)
) u ON TRUE;
