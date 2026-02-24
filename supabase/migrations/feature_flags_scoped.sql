-- Feature flags: allow scoped overrides (global/user/group)

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.feature_flags'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_global_unique
ON public.feature_flags (key)
WHERE scope = 'global' AND scope_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_scoped_unique
ON public.feature_flags (key, scope, scope_id)
WHERE scope IN ('user','group') AND scope_id IS NOT NULL;

