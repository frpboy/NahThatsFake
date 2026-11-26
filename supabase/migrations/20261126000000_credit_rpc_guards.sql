-- Credit RPC guards (PR #471 review follow-ups)
--
-- Two defects in the functions from 20261125000000_atomic_credits.sql:
--
-- 1. reserve_credit accepted a NULL idempotency key: it debited and
--    wrote a ledger row but created no reservation, so the debit could
--    never be settled or refunded (settle/release treat a NULL key as
--    'no_reservation'). It now rejects a NULL or empty key with
--    { status: 'invalid_key' } before touching any balance.
--
-- 2. release_credit refunded a daily credit unconditionally. A
--    reservation made before the midnight reset (scheduler.ts sets
--    daily_credits = 3 for every user) and released after it pushed the
--    balance to 4 — above the daily allowance. The daily refund is now
--    capped at that allowance: LEAST(daily_credits + 1, 3). The
--    intra-transaction undo refunds inside reserve_credit are NOT
--    capped: they reverse a debit taken moments earlier inside the
--    same transaction (the reset cannot interleave — it blocks on the
--    row lock the debit holds), so they always restore exactly.
--
-- APPLY ORDER: safe to apply before or after the matching bot deploy;
-- the previous bot code never passes a NULL key and is unaffected by
-- the refund cap. As with the original migration, the SQL here was
-- verified by inspection and by the bot's contract tests modelling it
-- (bot/tests/credits.test.ts); it has not been run against a live
-- Postgres in CI yet.

-- reserve_credit (guard added; body otherwise identical) -------------------

CREATE OR REPLACE FUNCTION reserve_credit(
  p_telegram_user_id TEXT,
  p_idempotency_key TEXT,
  p_check_type TEXT DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_user_id UUID;
  v_existing credit_reservations%ROWTYPE;
  v_has_existing BOOLEAN := FALSE;
  v_source TEXT;
BEGIN
  IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RETURN json_build_object('status', 'invalid_key', 'source', NULL);
  END IF;

  SELECT id INTO v_user_id FROM users WHERE telegram_user_id = p_telegram_user_id;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'no_user', 'source', NULL);
  END IF;

  SELECT * INTO v_existing FROM credit_reservations
    WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    v_has_existing := TRUE;
    IF v_existing.user_id <> v_user_id
       OR v_existing.state IN ('reserved', 'settled') THEN
      RETURN json_build_object('status', 'duplicate', 'source', v_existing.source);
    END IF;
    -- state = 'released': a retry of a refunded request. Fall through,
    -- debit again, and claim the row back below.
  END IF;

  -- Atomic debit. Each UPDATE is a single statement whose WHERE clause is
  -- re-evaluated against the newest committed row version, so two
  -- concurrent reserves can never spend the same credit.
  UPDATE users SET daily_credits = daily_credits - 1
    WHERE id = v_user_id AND daily_credits > 0;
  IF FOUND THEN
    v_source := 'daily';
  ELSE
    UPDATE users SET permanent_credits = permanent_credits - 1
      WHERE id = v_user_id AND permanent_credits > 0;
    IF FOUND THEN
      v_source := 'permanent';
    END IF;
  END IF;

  IF v_source IS NULL THEN
    RETURN json_build_object('status', 'none', 'source', NULL);
  END IF;

  IF v_has_existing THEN
    -- Claim the released reservation back. Losing this race means a
    -- concurrent retry already re-reserved: undo the debit above and
    -- report the duplicate instead.
    UPDATE credit_reservations
      SET state = 'reserved', source = v_source,
          check_type = p_check_type, updated_at = NOW()
      WHERE idempotency_key = p_idempotency_key AND state = 'released';
    IF NOT FOUND THEN
      IF v_source = 'daily' THEN
        UPDATE users SET daily_credits = daily_credits + 1 WHERE id = v_user_id;
      ELSE
        UPDATE users SET permanent_credits = permanent_credits + 1 WHERE id = v_user_id;
      END IF;
      SELECT source INTO v_source FROM credit_reservations
        WHERE idempotency_key = p_idempotency_key;
      RETURN json_build_object('status', 'duplicate', 'source', v_source);
    END IF;
  ELSE
    INSERT INTO credit_reservations (idempotency_key, user_id, source, state, check_type)
    VALUES (p_idempotency_key, v_user_id, v_source, 'reserved', p_check_type)
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF NOT FOUND THEN
      -- A concurrent request with the same key won the insert: undo the
      -- debit above and report the duplicate instead.
      IF v_source = 'daily' THEN
        UPDATE users SET daily_credits = daily_credits + 1 WHERE id = v_user_id;
      ELSE
        UPDATE users SET permanent_credits = permanent_credits + 1 WHERE id = v_user_id;
      END IF;
      SELECT source INTO v_source FROM credit_reservations
        WHERE idempotency_key = p_idempotency_key;
      RETURN json_build_object('status', 'duplicate', 'source', v_source);
    END IF;
  END IF;

  INSERT INTO credit_transactions (user_id, delta, source, kind, reason, check_type, idempotency_key)
  VALUES (v_user_id, -1, v_source, 'debit', 'check_reserve', p_check_type, p_idempotency_key);

  RETURN json_build_object('status', 'reserved', 'source', v_source);
END;
$$ LANGUAGE plpgsql;

-- release_credit (daily refund capped; body otherwise identical) -----------
-- Returns json: { status: 'released' | 'already_released' | 'already_settled'
--                 | 'no_reservation', source }

CREATE OR REPLACE FUNCTION release_credit(
  p_telegram_user_id TEXT,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT 'inconclusive'
)
RETURNS json AS $$
DECLARE
  v_user_id UUID;
  v_state TEXT;
  v_source TEXT;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RETURN json_build_object('status', 'no_reservation', 'source', NULL);
  END IF;

  SELECT id INTO v_user_id FROM users WHERE telegram_user_id = p_telegram_user_id;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'no_reservation', 'source', NULL);
  END IF;

  UPDATE credit_reservations
    SET state = 'released', updated_at = NOW()
    WHERE idempotency_key = p_idempotency_key
      AND user_id = v_user_id
      AND state = 'reserved'
    RETURNING source INTO v_source;
  IF NOT FOUND THEN
    SELECT state, source INTO v_state, v_source FROM credit_reservations
      WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id;
    IF NOT FOUND THEN
      RETURN json_build_object('status', 'no_reservation', 'source', NULL);
    END IF;
    RETURN json_build_object('status', 'already_' || v_state, 'source', v_source);
  END IF;

  IF v_source = 'daily' THEN
    -- Cap at the daily allowance (3, the value the midnight reset in
    -- scheduler.ts assigns): a reservation taken before the reset and
    -- released after it must not push the balance above the allowance.
    UPDATE users SET daily_credits = LEAST(daily_credits + 1, 3) WHERE id = v_user_id;
  ELSE
    UPDATE users SET permanent_credits = permanent_credits + 1 WHERE id = v_user_id;
  END IF;

  INSERT INTO credit_transactions (user_id, delta, source, kind, reason, idempotency_key)
  VALUES (v_user_id, 1, v_source, 'refund', COALESCE(p_reason, 'inconclusive'), p_idempotency_key);

  RETURN json_build_object('status', 'released', 'source', v_source);
END;
$$ LANGUAGE plpgsql;
