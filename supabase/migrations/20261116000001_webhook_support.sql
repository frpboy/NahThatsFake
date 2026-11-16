-- Webhook support: Telegram update idempotency + lazy daily credit reset.
-- See bot/src/webhook.ts and bot/src/utils/credits.ts.

-- 1. processed_updates: dedupe Telegram webhook deliveries (Telegram retries
--    until it gets a non-5xx response, up to ~24h). Service role only.
CREATE TABLE IF NOT EXISTS public.processed_updates (
  update_id BIGINT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processed_updates_received_at_idx
  ON public.processed_updates (received_at);

ALTER TABLE public.processed_updates ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only the service role (bot) may read/write this table.

-- Rows older than 48h can be pruned safely (Telegram never retries updates
-- older than 24h). Optional cleanup can run via Vercel cron later.

-- 2. Lazy daily credit reset: the bot resets free users' daily_credits to 3 on
--    their first request of each IST day, replacing the midnight-IST node-cron
--    job for the serverless deployment.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS daily_credits_date DATE;
