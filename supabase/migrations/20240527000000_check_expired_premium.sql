-- Function to check and downgrade expired premium plans
CREATE OR REPLACE FUNCTION check_expired_premium()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Downgrade Users
    UPDATE users
    SET 
        plan = 'free',
        premium_until = NULL,
        updated_at = NOW()
    WHERE 
        plan != 'free' 
        AND premium_until IS NOT NULL 
        AND premium_until < NOW();

    -- 2. Downgrade Groups linked to expired users
    -- Logic: If the user's plan expired (handled above), or the group's specific expiry date passed
    -- We can just check group's premium_until directly since it should be synced with user's
    UPDATE groups
    SET 
        plan = 'free',
        premium_until = NULL,
        autoscan_enabled = FALSE,
        updated_at = NOW()
    WHERE 
        plan != 'free' 
        AND premium_until IS NOT NULL 
        AND premium_until < NOW();

    -- 3. Sync: If a user was downgraded above, their linked groups should also be downgraded immediately
    -- (The query above handles time-based expiry, but let's double check consistency)
    -- This update handles cases where user might have been manually downgraded
    UPDATE groups g
    SET 
        plan = 'free',
        premium_until = NULL,
        autoscan_enabled = FALSE,
        updated_at = NOW()
    FROM users u
    WHERE 
        g.admin_user_id = u.id
        AND u.plan = 'free'
        AND g.plan != 'free';

END;
$$;

-- Function to reset daily counters (for completeness, since scheduler calls it)
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Reset daily credits for free users
    UPDATE users
    SET daily_credits = 3
    WHERE plan = 'free';

    -- Reset any other daily limits if needed
    -- (e.g. daily scan counts for groups, though not strictly defined yet)
END;
$$;
