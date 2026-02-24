-- Owner Power Features

-- 1) Impersonation logs
CREATE TABLE IF NOT EXISTS public.impersonation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  reason text
);

-- 2) Feature flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  scope text NOT NULL CHECK (scope IN ('global','user','group')),
  scope_id text,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- 3) Abuse simulation marker
ALTER TABLE public.abuse_flags
ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false;

-- 4) Allow org_custom in group plan constraint (drop old plan check + re-add)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.groups'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%plan = ANY%'
  LOOP
    EXECUTE format('ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.groups
ADD CONSTRAINT groups_plan_check CHECK (plan = ANY (ARRAY['free'::text, 'grp_monthly'::text, 'grp_annual'::text, 'org_custom'::text]));

-- 5) Group heatmap view
CREATE OR REPLACE VIEW public.group_heatmap AS
SELECT
  g.id AS group_id,
  g.telegram_group_id,
  g.group_name,
  g.plan,
  g.premium_until,
  COUNT(c.id) AS total_checks,
  COALESCE(AVG(c.score), 0) AS avg_risk,
  CASE
    WHEN COUNT(c.id) = 0 THEN 0
    ELSE ROUND((SUM(CASE WHEN c.risk_level = 'HIGH' THEN 1 ELSE 0 END)::numeric / COUNT(c.id)::numeric) * 100, 1)
  END AS high_risk_pct,
  COUNT(a.id) AS abuse_flags
FROM public.groups g
LEFT JOIN public.checks c ON c.group_id = g.id
LEFT JOIN public.abuse_flags a ON a.user_id = g.admin_user_id
GROUP BY g.id;

