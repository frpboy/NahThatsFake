-- Growth Engine Migration

-- 1. Add referral stats to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referral_credits INT DEFAULT 0;

-- 2. Index for leaderboard speed
CREATE INDEX IF NOT EXISTS idx_users_referral_count ON users(referral_count DESC);

-- 3. Function to handle referral rewards safely
CREATE OR REPLACE FUNCTION process_referral_reward(referrer_id UUID, referee_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update Referrer
    UPDATE users
    SET 
        permanent_credits = permanent_credits + 2, -- 2 credits for referrer
        referral_count = referral_count + 1,
        total_referral_credits = total_referral_credits + 2,
        updated_at = NOW()
    WHERE id = referrer_id;

    -- Update Referee (Bonus)
    UPDATE users
    SET 
        permanent_credits = permanent_credits + 1, -- 1 bonus credit for new user
        updated_at = NOW()
    WHERE id = referee_id;
END;
$$;
