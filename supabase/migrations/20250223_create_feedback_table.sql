CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id TEXT NOT NULL,
    username TEXT,
    first_name TEXT,
    type TEXT CHECK (type IN ('suggestion', 'bug', 'complaint', 'other')),
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'replied', 'ignored')),
    created_at TIMESTAMPTZ DEFAULT now(),
    reply_message_id TEXT,
    owner_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(telegram_user_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON "public"."feedback"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for all users" ON "public"."feedback"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "public"."feedback"
AS PERMISSIVE FOR UPDATE
TO public
USING (true);
