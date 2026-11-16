-- Webhook support: Telegram update work-state with per-effect phases,
-- identity-bound idempotent credit charging with outcome recording, and
-- DB-backed elapsed-window rate limiting with update-deduped counting.
-- See bot/src/webhook.ts, bot/src/phases.ts, bot/src/utils/credits.ts,
-- bot/src/middleware/rateLimit.ts.

-- 1. processed_updates: durable work-state for Telegram webhook deliveries.
--    Telegram retries a delivery until it gets a non-5xx response (up to ~24h).
--    status: processing (claimed) -> done | failed | ambiguous.
--    - failed: safe to reprocess; every effect phase is idempotent.
--    - ambiguous: an irreversible effect (paid provider call / result reply)
--      may or may not have happened. Automatic processing STOPS here; a later
--      delivery acks without effects. Repair is an operator action.
--    reply_phase: NULL -> no result reply attempted; 'replying' -> reply send
--    started but unconfirmed; 'replied' -> reply confirmed, only the done
--    marker was missing.
CREATE TABLE IF NOT EXISTS public.processed_updates (
  update_id BIGINT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'failed', 'ambiguous')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  -- Fencing token: only the current claim owner may transition status, so a
  -- stale worker cannot overwrite its successor's state.
  claim_token UUID,
  reply_phase TEXT CHECK (reply_phase IN ('replying', 'replied'))
);

CREATE INDEX IF NOT EXISTS processed_updates_received_at_idx
  ON public.processed_updates (started_at);

ALTER TABLE public.processed_updates ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only the service role (bot) may read/write this table.
-- Rows older than 48h can be pruned safely (Telegram never retries updates
-- older than 24h). Optional cleanup can run via Vercel cron later.

-- 2. credit_charges: idempotency + outcome ledger. Every update that reaches
--    credit consumption records its outcome EXACTLY ONCE, including zero-cost
--    outcomes ('premium'/'owner'), so a retry always replays the recorded
--    outcome instead of re-evaluating plan state that may have changed.
CREATE TABLE IF NOT EXISTS public.credit_charges (
  update_id BIGINT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('daily', 'permanent', 'premium', 'owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_charges ENABLE ROW LEVEL SECURITY;

-- 3. Lazy daily credit reset tracking (IST day), replacing the midnight-IST
--    node-cron reset which cannot run on serverless.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS daily_credits_date DATE;

-- 4. Atomic credit consumption. Serializes per update_id FIRST (advisory
--    transaction lock), so concurrent deliveries of the same update - for any
--    user - execute strictly one after another. The ledger is then both the
--    idempotency record and the identity binding: a recorded outcome for a
--    DIFFERENT telegram_user_id is a contract violation and raises instead of
--    charging anyone. Returns 'daily' | 'permanent' | 'premium' | 'owner'
--    | NULL (user missing or no credits left; not recorded, retry re-evaluates).
CREATE OR REPLACE FUNCTION consume_credit_atomic(p_telegram_user_id TEXT, p_update_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_type TEXT;
  v_existing credit_charges%ROWTYPE;
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- Serialize ALL same-update executions before any effect.
  PERFORM pg_advisory_xact_lock(p_update_id);

  -- Recorded outcome for this update: replay it for the same user, reject a
  -- contradictory identity without side effects.
  SELECT * INTO v_existing FROM credit_charges WHERE update_id = p_update_id;
  IF FOUND THEN
    IF v_existing.telegram_user_id <> p_telegram_user_id THEN
      RAISE EXCEPTION 'credit_charges identity conflict: update_id % recorded for a different user', p_update_id;
    END IF;
    RETURN v_existing.credit_type;
  END IF;

  SELECT * INTO v_user FROM users WHERE telegram_user_id = p_telegram_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_user.role = 'owner' THEN
    v_type := 'owner';
  ELSIF v_user.plan <> 'free' AND v_user.premium_until IS NOT NULL AND v_user.premium_until > now() THEN
    v_type := 'premium';
  ELSE
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
  END IF;

  -- No ON CONFLICT: the advisory lock makes a same-update conflict impossible
  -- unless the operation contract was violated, in which case a loud
  -- unique_violation rolls back every effect of this call.
  INSERT INTO credit_charges (update_id, telegram_user_id, credit_type)
  VALUES (p_update_id, p_telegram_user_id, v_type);

  RETURN v_type;
END;
$$;

-- 5. Rate limiting: DB-backed ELAPSED window (semantics preserved from the
--    long-poll in-memory Map: the window starts at the user's first hit and
--    resets 60s after that, it is NOT aligned to clock minutes), shared
--    across serverless instances, with per-update dedupe so a retried
--    delivery is counted once.
CREATE TABLE IF NOT EXISTS public.rate_limit_windows (
  user_id TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limit_windows ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  update_id BIGINT PRIMARY KEY,
  user_id TEXT NOT NULL,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- rate_limit_hits rows older than 24h can be pruned safely.

CREATE OR REPLACE FUNCTION rate_limit_hit(p_telegram_user_id TEXT, p_update_id BIGINT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_start TIMESTAMPTZ;
BEGIN
  -- Serialize same-update calls first so concurrent deliveries cannot both
  -- pass the dedupe check below.
  IF p_update_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(p_update_id);
  END IF;

  -- Dedupe: a retried delivery of the same update returns its recorded count
  -- without consuming another hit.
  IF p_update_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM rate_limit_hits WHERE update_id = p_update_id) THEN
      SELECT hit_count INTO v_count FROM rate_limit_windows WHERE user_id = p_telegram_user_id;
      RETURN COALESCE(v_count, 1);
    END IF;
  END IF;

  INSERT INTO rate_limit_windows (user_id, window_start, hit_count)
  VALUES (p_telegram_user_id, now(), 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT window_start, hit_count INTO v_start, v_count
    FROM rate_limit_windows WHERE user_id = p_telegram_user_id FOR UPDATE;

  IF now() - v_start >= interval '60 seconds' THEN
    UPDATE rate_limit_windows SET window_start = now(), hit_count = 1 WHERE user_id = p_telegram_user_id;
    v_count := 1;
  ELSE
    UPDATE rate_limit_windows SET hit_count = hit_count + 1 WHERE user_id = p_telegram_user_id;
    v_count := v_count + 1;
  END IF;

  IF p_update_id IS NOT NULL THEN
    INSERT INTO rate_limit_hits (update_id, user_id) VALUES (p_update_id, p_telegram_user_id);
  END IF;

  RETURN v_count;
END;
$$;

-- 6. Scan-cache phase marker: a 'pending' row is written BEFORE the provider
--    call. A later delivery seeing a live pending row knows the provider may
--    already have been called (uncertain spend) and must NOT call it again;
--    the operation stops as ambiguous. Pending rows expire after 10 minutes
--    (a real provider call completes in well under a minute); completed rows
--    keep their normal 30d/7d cache lifetimes. NULL = legacy complete row.
ALTER TABLE public.check_cache
  ADD COLUMN IF NOT EXISTS scan_status TEXT CHECK (scan_status IN ('pending', 'complete'));

-- Privilege hardening: SECURITY DEFINER functions are executable by PUBLIC by
-- default, which would let anon/authenticated keys call them directly and
-- bypass the table-level RLS intent. Restrict execution to the service role.
REVOKE ALL ON FUNCTION consume_credit_atomic(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_credit_atomic(TEXT, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rate_limit_hit(TEXT, BIGINT) TO service_role;
