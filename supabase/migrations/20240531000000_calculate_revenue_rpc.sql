-- Aggregate revenue without exposing it to browser or authenticated clients.
CREATE OR REPLACE FUNCTION public.get_total_revenue()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'inr', COALESCE(SUM(amount_inr), 0) / 100.0,
    'stars', COALESCE(SUM(amount_stars), 0)
  )
  FROM public.payments
  WHERE status = 'success';
$$;

REVOKE ALL ON FUNCTION public.get_total_revenue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_total_revenue() TO service_role;
