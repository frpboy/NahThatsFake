# NahThatsFake — Tech Stack & Architecture Report

Date: 2026-02-24

## High-Level Architecture

The system is a 3-part monorepo:

1) Telegram Bot (`bot/`)
- Runs as a Node.js service.
- Receives Telegram updates (polling/webhook depends on deployment).
- Calls external detection APIs.
- Reads/writes Supabase for users, credits, checks, payments, abuse flags, feedback.

2) Telegram Mini App (`tma/`)
- Static HTML/CSS/JS frontend served by Express.
- Backend endpoints validate Telegram init data, then fetch user profile and checks from Supabase.
- Handles Razorpay order creation + webhook processing (backend side).

3) Supabase (`supabase/`)
- PostgreSQL schema + functions + policies.
- Stores all business state.

## Languages & Frameworks

### Bot

- Language: TypeScript
- Runtime: Node.js
- Telegram framework: `grammy`
- HTTP: `axios`
- Scheduling: `node-cron`
- Env: `dotenv`
- DB: `@supabase/supabase-js` using service role key

See: [bot/package.json](file:///d:/K4NN4N/tg%20bot/NahThatsFake/bot/package.json)

### TMA

- Frontend: HTML + CSS + Vanilla JS (Telegram WebApp SDK)
- Backend: Express
- DB: `@supabase/supabase-js` (anon key)
- Payments: Razorpay SDK
- Security: server-side initData validation using HMAC (Telegram WebAppData scheme)

See: [tma/package.json](file:///d:/K4NN4N/tg%20bot/NahThatsFake/tma/package.json)

### Database

- Supabase Postgres (RLS enabled)
- Migrations live in `supabase/migrations/`

Key tables (current):
- `users` (plan, credits, role, bans/throttle)
- `checks` (history; references `users.id`)
- `check_cache` (dedupe/cache)
- `payments` (subscriptions + credit packs)
- `referrals`
- `groups`
- `abuse_flags`
- `admin_logs`
- `feedback`
- `impersonation_logs` (owner power)
- `feature_flags` (owner power)

## External Integrations

### Detection

- Sightengine (deepfake/AI image detection) — used by bot image handler.
- Google Safe Browsing + VirusTotal — link scanning pipeline (via internal urlscanner service).

### Payments

- Telegram Stars — handled inside bot via successful payment events.
- Razorpay — handled inside TMA backend (order creation + webhook).

### Ads

- AdsGram — `/earn` command pulls ads and sends to user.

## Deployment Model

### Bot

- Dockerized (`bot/Dockerfile` at repo root uses the bot folder).
- Intended to run on a VM/container platform.

### TMA

- Runs as Express app locally; can be deployed either:
  - as a container (`tma/Dockerfile`), or
  - as Vercel serverless function with rewrites (`tma/vercel.json`).

## Environment Variables (Summary)

### Bot (`bot/`)

Required:
- `BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended/optional:
- `SIGHTENGINE_API_KEY`
- `SIGHTENGINE_API_SECRET`
- `GOOGLE_SAFE_BROWSING_KEY`
- `VIRUSTOTAL_API_KEY`
- `TMA_URL`
- `ADSGRAM_TOKEN`
- `ADSGRAM_BLOCK_ID`
- `ADSGRAM_LANGUAGE`

Example file: [bot/.env.example](file:///d:/K4NN4N/tg%20bot/NahThatsFake/bot/.env.example)

### TMA (`tma/`)

Required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `BOT_TOKEN` (for Telegram initData verification)

Payments:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

## Security Model (As Implemented)

- Bot uses Supabase service role key; treat bot container as trusted.
- TMA validates Telegram initData server-side before returning any user data.
- Sensitive secrets are no longer meant to be committed (repo ignores `.env`).
- Owner RBAC is DB-only (role in `users`), not environment-based.

## Where to Look in Code

- Bot entrypoint: [index.ts](file:///d:/K4NN4N/tg%20bot/NahThatsFake/bot/src/index.ts)
- Credits logic: [credits.ts](file:///d:/K4NN4N/tg%20bot/NahThatsFake/bot/src/utils/credits.ts)
- User creation helper: [user.ts](file:///d:/K4NN4N/tg%20bot/NahThatsFake/bot/src/utils/user.ts)
- Image handler: [image.ts](file:///d:/K4NN4N/tg%20bot/NahThatsFake/bot/src/handlers/image.ts)
- Link handler: [link.ts](file:///d:/K4NN4N/tg%20bot/NahThatsFake/bot/src/handlers/link.ts)
- Group linking: [group.ts](file:///d:/K4NN4N/tg%20bot/NahThatsFake/bot/src/handlers/group.ts)
- TMA backend: [server.js](file:///d:/K4NN4N/tg%20bot/NahThatsFake/tma/server.js)
- Supabase schema baseline: [20240222200000_schema.sql](file:///d:/K4NN4N/tg%20bot/NahThatsFake/supabase/migrations/20240222200000_schema.sql)

