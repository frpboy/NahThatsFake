-- Abuse System Migration (Phase 4)

-- 1. Add Abuse Flags Table
CREATE TABLE IF NOT EXISTS abuse_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    flag_type TEXT NOT NULL, -- 'rate_limit', 'spam', 'fake_report', etc.
    details JSONB DEFAULT '{}'::jsonb,
    auto_action TEXT DEFAULT 'pending', -- 'pending', 'throttled', 'banned', 'ignored'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add enforcement columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS throttled_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_throttled BOOLEAN DEFAULT FALSE; -- Redundant if using throttled_until, but good for quick checks

-- 3. RLS for Abuse Flags
ALTER TABLE abuse_flags ENABLE ROW LEVEL SECURITY;

-- Only admins/system can insert flags (via service role key mostly)
-- But if we want RLS:
CREATE POLICY "System can insert flags" ON abuse_flags
    FOR INSERT
    WITH CHECK (true); -- Service role bypasses RLS anyway

-- Admins can view flags
CREATE POLICY "Admins can view flags" ON abuse_flags
    FOR SELECT
    USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'owner')));
