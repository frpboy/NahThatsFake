ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS daily_credits INTEGER NOT NULL DEFAULT 3 CHECK (daily_credits >= 0);

UPDATE public.users
SET daily_credits = 3
WHERE daily_credits IS NULL;

