-- Atomic credit consumption (implementation plan 1.4, fixes #410)
--
-- Replaces the bot's read-then-write credit debit with three Postgres
-- functions that run as single transactions:
--   reserve_credit()  -- atomically debit daily-then-permanent, once per
--                        idempotency key, and write the ledger debit row
--   settle_credit()   -- mark a reservation final (a verdict was delivered)
--   release_credit()  -- refund a reservation whose check ended
--                        inconclusive / provider-down, with a ledger refund
--
-- APPLY ORDER: apply this migration BEFORE deploying bot code that calls
-- these functions. The bot also has a legacy fallback for the
-- function-missing case, but the migration-first order is the supported
-- rollout. The bot connects with the service role, which bypasses RLS;
-- the policies below only govern direct client access.

-- 1. Reservation state, one row per check request ---------------------------

CREATE TABLE IF NOT EXISTS credit_reservations (
  idempotency_key TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id),
  source          TEXT NOT NULL CHECK (source IN ('daily', 'permanent')),
  state           TEXT NOT NULL DEFAULT 'reserved'
                  CHECK (state IN ('reserved', 'settled', 'released')),
  check_type      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Append-only credit ledger ----------------------------------------------
-- Exactly one 'debit' row per successful reserve and one 'refund' row per
-- release, written inside the same transaction as the balance change.

CREATE TABLE IF NOT EXISTS credit_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  delta           INTEGER NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('daily', 'permanent')),
  kind            TEXT NOT NULL CHECK (kind IN ('debit', 'refund')),
  reason          TEXT,
  check_type      TEXT,
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_idx
  ON credit_transactions (user_id, created_at);
CREATE INDEX IF NOT EXISTS credit_transactions_key_idx
  ON credit_transactions (idempotency_key);

-- 3. RLS: writes are server-only (service role); admins may view -----------

ALTER TABLE credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view credit reservations" ON credit_reservations
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'owner')));

CREATE POLICY "Admins can view credit transactions" ON credit_transactions
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'owner')));

-- 4. reserve_credit ----------------------------------------------------------
-- Returns json: { status: 'reserved' | 'duplicate' | 'none' | 'no_user',
--                 source: 'daily' | 'permanent' | NULL }
-- 'duplicate' means this idempotency key already holds (or settled) a
-- credit; no second debit is taken.

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
  SELECT id INTO v_user_id FROM users WHERE telegram_user_id = p_telegram_user_id;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'no_user', 'source', NULL);
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
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

  IF p_idempotency_key IS NOT NULL THEN
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
  END IF;

  INSERT INTO credit_transactions (user_id, delta, source, kind, reason, check_type, idempotency_key)
  VALUES (v_user_id, -1, v_source, 'debit', 'check_reserve', p_check_type, p_idempotency_key);

  RETURN json_build_object('status', 'reserved', 'source', v_source);
END;
$$ LANGUAGE plpgsql;

-- 5. settle_credit -----------------------------------------------------------
-- Returns json: { status: 'settled' | 'already_settled' | 'already_released'
--                 | 'no_reservation', source }

CREATE OR REPLACE FUNCTION settle_credit(
  p_telegram_user_id TEXT,
  p_idempotency_key TEXT
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
    SET state = 'settled', updated_at = NOW()
    WHERE idempotency_key = p_idempotency_key
      AND user_id = v_user_id
      AND state = 'reserved'
    RETURNING source INTO v_source;
  IF FOUND THEN
    RETURN json_build_object('status', 'settled', 'source', v_source);
  END IF;

  SELECT state, source INTO v_state, v_source FROM credit_reservations
    WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('status', 'no_reservation', 'source', NULL);
  END IF;
  RETURN json_build_object('status', 'already_' || v_state, 'source', v_source);
END;
$$ LANGUAGE plpgsql;

-- 6. release_credit ----------------------------------------------------------
-- Refunds the exact source the reservation consumed and writes the ledger
-- refund row, in the same transaction. Releasing a settled reservation is
-- a no-op ('already_settled'); releasing twice is a no-op
-- ('already_released').
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
    UPDATE users SET daily_credits = daily_credits + 1 WHERE id = v_user_id;
  ELSE
    UPDATE users SET permanent_credits = permanent_credits + 1 WHERE id = v_user_id;
  END IF;

  INSERT INTO credit_transactions (user_id, delta, source, kind, reason, idempotency_key)
  VALUES (v_user_id, 1, v_source, 'refund', COALESCE(p_reason, 'inconclusive'), p_idempotency_key);

  RETURN json_build_object('status', 'released', 'source', v_source);
END;
$$ LANGUAGE plpgsql;
