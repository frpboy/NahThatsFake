-- Admin Role and Logs Migration

-- 1. Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
-- Valid roles: 'user', 'admin', 'owner'

-- 2. Create admin_logs table
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    target_user_id UUID, -- Can be null for system actions
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins/owners to read logs
CREATE POLICY "Admins can view logs" ON admin_logs
    FOR SELECT
    USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'owner')));

-- Allow admins/owners to insert logs
CREATE POLICY "Admins can insert logs" ON admin_logs
    FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'owner')));
