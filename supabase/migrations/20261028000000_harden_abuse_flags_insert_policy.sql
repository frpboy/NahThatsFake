-- Remove the permissive client INSERT policy. Trusted server-side code uses the
-- Supabase service role, which bypasses RLS. Keep abuse flag writes server-only.
DROP POLICY IF EXISTS "System can insert flags" ON public.abuse_flags;
