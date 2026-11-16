-- Webhook support: Telegram update work-state, idempotent credit charging,
-- DB-backed rate limiting, and lazy daily credit reset.
-- See bot/src/webhook.ts, bot/src/utils/credits.ts, bot/src/middleware/rateLimit.ts.

-- 1. processed_updates: durable work-state for Telegram webhook deliveries.
--    Telegram retries a delivery until it gets a non-5xx response (up to ~24h).
--    status: processing (claimed) -> done | failed. A stale 'processing' row
--    (started_at older than the handler's takeover window) means its
--    invocation died and a retry may re-claim the update.
CREATE TABLE IF NOT EXISTS public.processed_updates (
  update_id BIGINT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS processed_updates_received_at_idx
  ON public.processed_updates (started_at);

ALTER TABLE public.processed_updates ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only the service role (bot) may read/write this table.
-- Rows older than 48h can be pruned safely (Telegram never retries updates
-- older than 24h). Optional cleanup can run via Vercel cron later.

-- 2. credit_charges: idempotency ledger so a webhook retry of the same update
--    never consumes a credit twice.
CREATE TABLE IF NOT EXISTS public.credit_charges (
  update_id BIGINT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('daily', 'permanent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_charges ENABLE ROW LEVEL SECURITY;

-- 3. Lazy daily credit reset tracking (IST day), replacing the midnight-IST
--    node-cron reset which cannot run on serverless.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS daily_credits_date DATE;

-- 4. Atomic credit consumption: row lock + lazy reset + decrement + idempotency
--    ledger in a single transaction. Returns 'daily' | 'permanent' | 'premium'
--    | 'owner' | NULL (user missing or no credits left).
CREATE OR REPLACE FUNCTION consume_credit_atomic(p_telegram_user_id TEXT, p_update_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_type TEXT;
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- Idempotent replay: this update already charged (or was processed as
  -- owner/premium, which records no charge - recompute is free below).
  SELECT credit_type INTO v_type FROM credit_charges WHERE update_id = p_update_id;
  IF FOUND THEN
    RETURN v_type;
  END IF;

  SELECT * INTO v_user FROM users WHERE telegram_user_id = p_telegram_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_user.role = 'owner' THEN
    RETURN 'owner';
  END IF;

  IF v_user.plan <> 'free' AND v_user.premium_until IS NOT NULL AND v_user.premium_until > now() THEN
    RETURN 'premium';
  END IF;

  -- Lazy daily reset (IST day) in the same transaction; users whose premium
  -- expired are effectively on the free plan and get the reset too.
  IF v_user.daily_credits_date IS NULL OR v_user.daily_credits_date < v_today THEN
    v_user.daily_credits := 3;
    v_user.daily_credits_date := v_today;
  END IF;

  IF v_user.daily_credits > 0 THEN
    v_type := 'daily';
    UPDATE users
      SET daily_credits = v_user.daily_credits - 1,
          daily_credits_date = v_user.daily_credits_date,
          updated_at = now()
      WHERE id = v_user.id;
  ELSIF v_user.permanent_credits > 0 THEN
    v_type := 'permanent';
    UPDATE users
      SET permanent_credits = v_user.permanent_credits - 1,
          daily_credits_date = v_user.daily_credits_date,
          updated_at = now()
      WHERE id = v_user.id;
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO credit_charges (update_id, telegram_user_id, credit_type)
  VALUES (p_update_id, p_telegram_user_id, v_type)
  ON CONFLICT (update_id) DO NOTHING;

  RETURN v_type;
END;
$$;

-- 5. rate_limit_windows + rate_limit_hit: DB-backed fixed-minute-window
--    counter, replacing the per-process in-memory Map that cannot work
--    across serverless instances.
CREATE TABLE IF NOT EXISTS public.rate_limit_windows (
  user_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

ALTER TABLE public.rate_limit_windows ENABLE ROW LEVEL SECURITY;
-- Rows older than ~1h can be pruned safely. Optional cleanup via Vercel cron.

CREATE OR REPLACE FUNCTION rate_limit_hit(p_telegram_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limit_windows (user_id, window_start, hit_count)
  VALUES (p_telegram_user_id, date_trunc('minute', now()), 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET hit_count = rate_limit_windows.hit_count + 1
  RETURNING hit_count INTO v_count;
  RETURN v_count;
END;
$$;
