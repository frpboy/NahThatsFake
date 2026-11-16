-- Webhook support: Telegram update work-state with per-effect phases,
-- identity-bound idempotent credit charging with outcome recording, and
-- DB-backed elapsed-window rate limiting with per-update decision replay.
-- See bot/src/webhook.ts, bot/src/phases.ts, bot/src/utils/credits.ts,
-- bot/src/middleware/rateLimit.ts.
--
-- Precondition: VIRGIN state. No PR451 migration revision was ever applied
-- to production (no apply was authorized or executed), and this file REFUSES
-- to run over any prior revision state (see the preflight block below): an
-- implicit upgrade would fabricate or destroy operation state. If the
-- preflight trips, the operator must verify what exists and reconcile
-- manually before applying - that is a deliberate stop, not an error to
-- bypass. The deployment checklist must record the preflight result.

-- 0. Preflight: refuse on ANY prior revision state.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('processed_updates', 'credit_charges', 'rate_limit_windows', 'rate_limit_hits', 'rate_limit_windows_legacy_v1')
  ) OR EXISTS (
    SELECT 1 FROM pg_proc WHERE proname IN ('consume_credit_atomic', 'rate_limit_hit')
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'check_cache'
      AND column_name IN ('scan_status', 'pending_update_id')
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'daily_credits_date'
  ) THEN
    RAISE EXCEPTION 'webhook_support preflight: prior revision state detected. Refusing implicit upgrade - verify and reconcile existing objects manually before applying.';
  END IF;
END $$;

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
--    across serverless instances. Every counted update records its DECISION
--    (the count it was assigned, its window and its user); a retried delivery
--    replays that recorded decision exactly - never the user's current window
--    count, which may have moved on (admitted work must stay admitted on
--    retry, dropped work must stay dropped). The record is identity-bound: a
--    recorded decision for a different user raises instead of answering.
CREATE TABLE IF NOT EXISTS public.rate_limit_windows (
  user_id TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limit_windows ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  update_id BIGINT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hit_count INTEGER NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
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
  v_recorded_user TEXT;
BEGIN
  IF p_update_id IS NOT NULL THEN
    -- Serialize same-update calls so concurrent deliveries cannot both pass
    -- the replay check below.
    PERFORM pg_advisory_xact_lock(p_update_id);

    -- Decision replay: return the exact count this update was assigned, and
    -- only to the user it was recorded for.
    SELECT user_id, hit_count INTO v_recorded_user, v_count
      FROM rate_limit_hits WHERE update_id = p_update_id;
    IF FOUND THEN
      IF v_recorded_user <> p_telegram_user_id THEN
        RAISE EXCEPTION 'rate_limit_hits identity conflict: update_id % recorded for a different user', p_update_id;
      END IF;
      RETURN v_count;
    END IF;
  END IF;

  INSERT INTO rate_limit_windows (user_id, window_start, hit_count)
  VALUES (p_telegram_user_id, now(), 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT window_start, hit_count INTO v_start, v_count
    FROM rate_limit_windows WHERE user_id = p_telegram_user_id FOR UPDATE;

  IF now() - v_start >= interval '60 seconds' THEN
    v_start := now();
    v_count := 1;
    UPDATE rate_limit_windows SET window_start = v_start, hit_count = 1 WHERE user_id = p_telegram_user_id;
  ELSE
    v_count := v_count + 1;
    UPDATE rate_limit_windows SET hit_count = v_count WHERE user_id = p_telegram_user_id;
  END IF;

  IF p_update_id IS NOT NULL THEN
    INSERT INTO rate_limit_hits (update_id, user_id, hit_count, window_start)
    VALUES (p_update_id, p_telegram_user_id, v_count, v_start);
  END IF;

  RETURN v_count;
END;
$$;

-- 6. Scan-cache phase marker: a 'pending' row is written BEFORE the provider
--    call, bound to the operation that owns it (pending_update_id). A later
--    delivery of the SAME update seeing its pending row knows the provider
--    may already have been called (uncertain spend) and must NOT call it
--    again; the operation stops as ambiguous. Time passing NEVER resolves
--    spend uncertainty: a pending marker is never reclaimed by expiry, only
--    by (a) the owning operation completing/clearing it, or (b) an explicit
--    NEW user operation (different update_id = a fresh, user-initiated scan
--    decision) claiming it with a guarded update. NULL scan_status = legacy
--    complete row.
ALTER TABLE public.check_cache
  ADD COLUMN IF NOT EXISTS scan_status TEXT CHECK (scan_status IN ('pending', 'complete'));
ALTER TABLE public.check_cache
  ADD COLUMN IF NOT EXISTS pending_update_id BIGINT;

-- Privilege hardening: SECURITY DEFINER functions are executable by PUBLIC by
-- default, which would let anon/authenticated keys call them directly and
-- bypass the table-level RLS intent. Restrict execution to the service role.
REVOKE ALL ON FUNCTION consume_credit_atomic(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_credit_atomic(TEXT, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rate_limit_hit(TEXT, BIGINT) TO service_role;
