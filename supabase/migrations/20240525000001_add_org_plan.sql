-- Add Org Plan and Groups Table

-- 1. Ensure org_custom is in plan enum (handled in previous migration technically, but safe to double check)
-- ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'org_custom';

-- 2. Create Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_group_id TEXT UNIQUE NOT NULL,
    group_name TEXT,
    admin_user_id UUID REFERENCES users(id), -- The user who linked it
    plan plan_enum DEFAULT 'free',
    premium_until TIMESTAMPTZ,
    premium_owner_id UUID REFERENCES users(id), -- Usually same as admin_user_id
    autoscan_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS for Groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Group admins can view their group
CREATE POLICY "Admins can view their groups" ON groups
    FOR SELECT
    USING (auth.uid() = admin_user_id);

-- Group admins can update settings
CREATE POLICY "Admins can update their groups" ON groups
    FOR UPDATE
    USING (auth.uid() = admin_user_id);
