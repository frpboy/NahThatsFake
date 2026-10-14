-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  telegram_user_id text NOT NULL UNIQUE,
  username text,
  first_name text,
  last_name text,
  plan text NOT NULL DEFAULT 'free'::text CHECK (plan = ANY (ARRAY['free'::text, 'ind_weekly'::text, 'ind_monthly'::text, 'ind_annual'::text, 'ind_lifetime'::text, 'ind_student'::text, 'creator_monthly'::text, 'grp_monthly'::text, 'grp_annual'::text, 'org_custom'::text])),
  premium_until timestamp with time zone,
  grace_until timestamp with time zone,
  payment_method text,
  last_payment_id text,
  last_paid_at timestamp with time zone,
  permanent_credits integer NOT NULL DEFAULT 0 CHECK (permanent_credits >= 0),
  referral_code text UNIQUE,
  referred_by text,
  consent_given boolean NOT NULL DEFAULT false,
  consent_at timestamp with time zone,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_active_at timestamp with time zone,
  is_banned boolean NOT NULL DEFAULT false,
  banned_reason text,
  banned_at timestamp with time zone,
  role text NOT NULL DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'owner'::text])),
  referral_count integer DEFAULT 0,
  total_referral_credits integer DEFAULT 0,
  daily_credits integer NOT NULL DEFAULT 3 CHECK (daily_credits >= 0),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  telegram_group_id text NOT NULL UNIQUE,
  group_name text,
  admin_user_id uuid,
  plan text NOT NULL DEFAULT 'free'::text CHECK (plan = ANY (ARRAY['free'::text, 'grp_monthly'::text, 'grp_annual'::text, 'org_custom'::text])),
  premium_until timestamp with time zone,
  grace_until timestamp with time zone,
  payment_id uuid,
  autoscan_enabled boolean NOT NULL DEFAULT false,
  autoscan_threshold numeric NOT NULL DEFAULT 0.85,
  autoscan_alerts_today integer NOT NULL DEFAULT 0,
  checks_today integer NOT NULL DEFAULT 0,
  total_checks integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  premium_owner_id uuid,
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id),
  CONSTRAINT fk_groups_payment FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  CONSTRAINT groups_premium_owner_id_fkey FOREIGN KEY (premium_owner_id) REFERENCES public.users(id)
);
CREATE TABLE public.checks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid,
  check_type text NOT NULL CHECK (check_type = ANY (ARRAY['image'::text, 'link'::text])),
  content_hash text NOT NULL,
  score numeric,
  risk_level text CHECK (risk_level = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text, 'LOW'::text])),
  raw_response jsonb,
  cached boolean NOT NULL DEFAULT false,
  api_source text,
  exif_present boolean,
  credit_source text CHECK (credit_source = ANY (ARRAY['daily'::text, 'permanent'::text, 'premium'::text, 'group'::text])),
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT checks_pkey PRIMARY KEY (id),
  CONSTRAINT checks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT checks_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.check_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  check_type text NOT NULL CHECK (check_type = ANY (ARRAY['image'::text, 'link'::text])),
  content_hash text NOT NULL,
  score numeric NOT NULL,
  risk_level text NOT NULL CHECK (risk_level = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text, 'LOW'::text])),
  api_source text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT check_cache_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id text NOT NULL,
  amount_inr integer,
  amount_stars integer,
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['razorpay'::text, 'stars'::text])),
  payment_id text,
  order_id text,
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'failed'::text, 'refunded'::text, 'pending'::text])),
  premium_from timestamp with time zone,
  premium_until timestamp with time zone,
  group_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  webhook_received_at timestamp with time zone,
  notes text,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT payments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'credited'::text, 'expired'::text, 'invalid'::text])),
  referrer_credits integer NOT NULL DEFAULT 1,
  referee_credits integer NOT NULL DEFAULT 2,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  credited_at timestamp with time zone,
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id),
  CONSTRAINT referrals_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES public.users(id)
);
CREATE TABLE public.abuse_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  flag_type text NOT NULL,
  details jsonb,
  auto_action text,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamp with time zone,
  reviewed_by text,
  resolution text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_simulated boolean NOT NULL DEFAULT false,
  CONSTRAINT abuse_flags_pkey PRIMARY KEY (id),
  CONSTRAINT abuse_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.admin_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_group_id uuid,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id),
  CONSTRAINT admin_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id),
  CONSTRAINT admin_logs_target_group_id_fkey FOREIGN KEY (target_group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  telegram_user_id text NOT NULL,
  username text,
  first_name text,
  type text CHECK (type = ANY (ARRAY['suggestion'::text, 'bug'::text, 'complaint'::text, 'other'::text])),
  message text NOT NULL,
  status text DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'replied'::text, 'ignored'::text])),
  created_at timestamp with time zone DEFAULT now(),
  reply_message_id text,
  owner_notes text,
  CONSTRAINT feedback_pkey PRIMARY KEY (id)
);
CREATE TABLE public.impersonation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  reason text,
  CONSTRAINT impersonation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT impersonation_logs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id),
  CONSTRAINT impersonation_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  scope text NOT NULL CHECK (scope = ANY (ARRAY['global'::text, 'user'::text, 'group'::text])),
  scope_id text,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_flags_pkey PRIMARY KEY (id)
);