-- Feedback contains user-submitted content and must not be readable or mutable
-- by arbitrary anon/authenticated clients. The trusted bot uses the Supabase
-- service role, which bypasses RLS.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.feedback;
DROP POLICY IF EXISTS "Enable update for all users" ON public.feedback;
-- Remove public direct inserts as well: feedback submission is handled server-side.
DROP POLICY IF EXISTS "Enable insert for all users" ON public.feedback;
