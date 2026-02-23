-- Update Plans Migration

-- 1. Create enum type for plans if not exists (or update it)
-- Since modifying enum types in Postgres is tricky inside a transaction block in some versions,
-- we'll assume it's text for now or alter it carefully.
-- If 'plan_type' enum exists:
-- ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'ind_weekly';
-- ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'ind_lifetime';
-- ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'credits_50';
-- ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'credits_100';
-- ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'ind_student';
-- ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'creator_monthly';
-- ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'grp_annual';
-- ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'org_custom';

-- For now, let's just ensure the check constraint on users.plan allows these values if it's a text column with check constraint.
-- If it's just text, no action needed.
-- If it's an enum, we need to add values.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_enum') THEN
        CREATE TYPE plan_enum AS ENUM (
            'free', 
            'ind_monthly', 
            'ind_annual', 
            'grp_monthly', 
            'grp_annual',
            'ind_weekly',
            'ind_lifetime',
            'credits_50',
            'credits_100',
            'ind_student',
            'creator_monthly',
            'org_custom'
        );
    ELSE
        -- Add new values if they don't exist
        ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'ind_weekly';
        ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'ind_lifetime';
        ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'credits_50';
        ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'credits_100';
        ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'ind_student';
        ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'creator_monthly';
        ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'grp_annual';
        ALTER TYPE plan_enum ADD VALUE IF NOT EXISTS 'org_custom';
    END IF;
END$$;

-- Ensure users table uses this enum or text check
-- ALTER TABLE users ALTER COLUMN plan TYPE plan_enum USING plan::plan_enum;
