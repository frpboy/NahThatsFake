
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id    TEXT NOT NULL UNIQUE,        -- Telegram's numeric ID as text
  username            TEXT,                        -- @handle (nullable, user may have none)
  first_name          TEXT,                        -- From Telegram profile
  last_name           TEXT,                        -- From Telegram profile (nullable)
  -- Plan & Premium
  plan                TEXT NOT NULL DEFAULT 'free' -- 'free'|'ind_monthly'|'ind_annual'|'grp_monthly'
                      CHECK (plan IN ('free','ind_monthly','ind_annual','grp_monthly')),
  premium_until       TIMESTAMPTZ,                 -- NULL = free user
  grace_until         TIMESTAMPTZ,                 -- premium_until + 3 days
  payment_method      TEXT,                        -- 'razorpay'|'stars'|NULL
  last_payment_id     TEXT,
  last_paid_at        TIMESTAMPTZ,
  -- Credits
  permanent_credits   INTEGER NOT NULL DEFAULT 0   CHECK (permanent_credits >= 0),
  -- Referral
  referral_code       TEXT UNIQUE,                 -- User's own code for sharing
  referred_by         TEXT,                        -- referral_code of who referred them
  -- Consent & Onboarding
  consent_given       BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at          TIMESTAMPTZ,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  -- Metadata
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at      TIMESTAMPTZ,
  is_banned           BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2. Groups Table (Created before checks/payments to allow references)
CREATE TABLE groups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_group_id   TEXT NOT NULL UNIQUE,  -- Telegram's chat ID (negative for groups)
  group_name          TEXT,
  admin_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Plan
  plan                TEXT NOT NULL DEFAULT 'free'
                      CHECK (plan IN ('free','grp_monthly')),
  premium_until       TIMESTAMPTZ,
  grace_until         TIMESTAMPTZ,
  payment_id          UUID, -- Circular reference resolved later or nullable
  -- Auto-scan
  autoscan_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  autoscan_threshold  NUMERIC(3,2) NOT NULL DEFAULT 0.85,  -- 0.85 = 85%
  autoscan_alerts_today INTEGER NOT NULL DEFAULT 0,        -- Reset daily
  -- Usage
  checks_today        INTEGER NOT NULL DEFAULT 0,          -- Reset midnight IST
  total_checks        INTEGER NOT NULL DEFAULT 0,
  -- Metadata
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE        -- FALSE = bot removed
);

-- 3. Checks Table
CREATE TABLE checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES groups(id) ON DELETE SET NULL, -- NULL = private chat
  -- Content
  check_type      TEXT NOT NULL CHECK (check_type IN ('image', 'link')),
  content_hash    TEXT NOT NULL,   -- SHA-256 of image bytes OR normalised URL
  -- Result
  score           NUMERIC(5,4),    -- 0.0000 to 1.0000 (4 decimal places)
  risk_level      TEXT CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  raw_response    JSONB,           -- Full API response for debugging
  -- Source
  cached          BOOLEAN NOT NULL DEFAULT FALSE,
  api_source      TEXT,            -- 'sightengine'|'google_safe_browsing'|'virustotal'|'combined'
  exif_present    BOOLEAN,         -- Image only: was EXIF metadata present?
  -- Credit tracking
  credit_source   TEXT CHECK (credit_source IN ('daily','permanent','premium','group')),
  -- Error tracking
  error           TEXT,            -- NULL = success. Error message if failed.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Check Cache Table
CREATE TABLE check_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type      TEXT NOT NULL CHECK (check_type IN ('image', 'link')),
  content_hash    TEXT NOT NULL,   -- SHA-256 of image bytes OR normalised URL
  score           NUMERIC(5,4) NOT NULL,
  risk_level      TEXT NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  api_source      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,  -- created_at + 30d (image) or 7d (link)
  UNIQUE (check_type, content_hash)  -- Prevent duplicate cache entries
);

-- 5. Payments Table
CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                   -- ON DELETE RESTRICT: cannot delete user with payment history
  -- Plan
  plan_id          TEXT NOT NULL,   -- 'ind_monthly'|'ind_annual'|'grp_monthly'
  -- Amount
  amount_inr       INTEGER,         -- In paise (₹99 = 9900). NULL for Stars payments.
  amount_stars     INTEGER,         -- Number of Stars. NULL for INR payments.
  -- Payment method
  payment_method   TEXT NOT NULL CHECK (payment_method IN ('razorpay', 'stars')),
  payment_id       TEXT,            -- Razorpay payment_id or Telegram charge_id
  order_id         TEXT,            -- Razorpay order_id (NULL for Stars)
  -- Status
  status           TEXT NOT NULL
                   CHECK (status IN ('success','failed','refunded','pending')),
  -- Premium period granted
  premium_from     TIMESTAMPTZ,     -- When premium started (on success)
  premium_until    TIMESTAMPTZ,     -- When premium ends (on success)
  -- Group (if group premium)
  group_id         UUID REFERENCES groups(id) ON DELETE SET NULL,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  webhook_received_at TIMESTAMPTZ, -- When webhook confirmed payment
  notes            TEXT            -- Internal notes
);

-- Add foreign key to groups for payment_id now that payments table exists
ALTER TABLE groups ADD CONSTRAINT fk_groups_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- 6. Referrals Table
CREATE TABLE referrals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- People
  referrer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Status
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','credited','expired','invalid')),
  -- Credit amounts
  referrer_credits   INTEGER NOT NULL DEFAULT 1,  -- Credits awarded to referrer
  referee_credits    INTEGER NOT NULL DEFAULT 2,  -- Credits awarded to referee
  -- Timing
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- When referee signed up
  credited_at        TIMESTAMPTZ,                         -- When first check completed
  UNIQUE (referrer_id, referee_id)  -- One referral per pair
);

-- 7. Abuse Flags Table
CREATE TABLE abuse_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  flag_type    TEXT NOT NULL,
               -- 'rate_limit_exceeded'
               -- 'referral_farming'
               -- 'payment_fraud'
               -- 'multi_account'
               -- 'spam_checks'
               -- 'webhook_spoof'
  details      JSONB,          -- Context: {checks_in_window: 55, window_minutes: 60}
  auto_action  TEXT,           -- What the system did: 'throttled'|'blocked'|'flagged'
  reviewed     BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  TEXT,           -- Your name/handle when you review
  resolution   TEXT,           -- 'confirmed_abuse'|'false_positive'|'warning_sent'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_telegram_id ON users (telegram_user_id);
CREATE INDEX idx_users_referral_code ON users (referral_code);
CREATE INDEX idx_users_plan ON users (plan);
CREATE INDEX idx_users_premium_until ON users (premium_until);

CREATE INDEX idx_checks_user_id ON checks (user_id);
CREATE INDEX idx_checks_created_at ON checks (created_at);
CREATE INDEX idx_checks_content_hash ON checks (content_hash);

CREATE INDEX idx_check_cache_hash ON check_cache (check_type, content_hash);
CREATE INDEX idx_check_cache_expires ON check_cache (expires_at);

CREATE INDEX idx_payments_user_id ON payments (user_id);
CREATE INDEX idx_payments_status ON payments (status);

CREATE INDEX idx_groups_telegram_id ON groups (telegram_group_id);

CREATE INDEX idx_referrals_referrer ON referrals (referrer_id);
CREATE INDEX idx_referrals_referee ON referrals (referee_id);
