
-- Database functions for Nah That's Fake

-- Function to update user last_active_at
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users 
  SET last_active_at = NOW() 
  WHERE telegram_user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_active_at on new checks
CREATE TRIGGER trigger_update_user_last_active
  AFTER INSERT ON checks
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_active();

-- Function to reset daily counters at midnight IST
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void AS $$
BEGIN
  -- Reset user daily check counters (handled by application logic)
  -- Reset group daily counters
  UPDATE groups SET 
    checks_today = 0,
    autoscan_alerts_today = 0,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM check_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update premium grace periods
CREATE OR REPLACE FUNCTION update_grace_periods()
RETURNS void AS $$
BEGIN
  -- Update user grace periods
  UPDATE users SET 
    grace_until = premium_until + INTERVAL '3 days',
    updated_at = NOW()
  WHERE premium_until IS NOT NULL 
    AND (grace_until IS NULL OR grace_until < premium_until + INTERVAL '3 days');

  -- Update group grace periods
  UPDATE groups SET 
    grace_until = premium_until + INTERVAL '3 days',
    updated_at = NOW()
  WHERE premium_until IS NOT NULL 
    AND (grace_until IS NULL OR grace_until < premium_until + INTERVAL '3 days');
END;
$$ LANGUAGE plpgsql;

-- Function to process referral credits
CREATE OR REPLACE FUNCTION process_referral_credit(referee_id UUID)
RETURNS void AS $$
DECLARE
  referral_record RECORD;
BEGIN
  -- Find pending referral for this referee
  SELECT * INTO referral_record
  FROM referrals
  WHERE referrals.referee_id = $1
    AND referrals.status = 'pending';

  IF FOUND THEN
    -- Award credits to both users
    UPDATE users SET 
      permanent_credits = permanent_credits + referral_record.referrer_credits
    WHERE id = referral_record.referrer_id;

    UPDATE users SET 
      permanent_credits = permanent_credits + referral_record.referee_credits
    WHERE id = referral_record.referee_id;

    -- Mark referral as credited
    UPDATE referrals SET 
      status = 'credited',
      credited_at = NOW()
    WHERE id = referral_record.id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check and downgrade expired premium
CREATE OR REPLACE FUNCTION check_expired_premium()
RETURNS void AS $$
BEGIN
  -- Downgrade expired user premium
  UPDATE users SET 
    plan = 'free',
    premium_until = NULL,
    updated_at = NOW()
  WHERE plan != 'free' 
    AND (premium_until + INTERVAL '3 days') < NOW() -- After grace period
    AND grace_until < NOW();

  -- Downgrade expired group premium
  UPDATE groups SET 
    plan = 'free',
    premium_until = NULL,
    autoscan_enabled = FALSE,
    updated_at = NOW()
  WHERE plan != 'free' 
    AND (premium_until + INTERVAL '3 days') < NOW() -- After grace period
    AND grace_until < NOW();
END;
$$ LANGUAGE plpgsql;
