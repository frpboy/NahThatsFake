# NahThatsFake — Project Status Report

Date: 2026-02-24

## Repository Layout

- `bot/`: Telegram bot (TypeScript) + detection handlers + admin/owner ops.
- `tma/`: Telegram Mini App (Express + static HTML/CSS/JS) + payment/API endpoints.
- `supabase/`: SQL migrations for PostgreSQL schema, functions, and views.
- `Documents/`: 13 original spec documents (HTML).

## What’s Built (Working in Code)

### Bot Core (Private Chat)

- Onboarding via `/start` with referral payload support.
- Credits system:
  - `daily_credits` (3/day)
  - `permanent_credits` (referrals / packs)
  - premium bypass for paid plans.
- Image checks:
  - downloads image from Telegram
  - hashes and caches results
  - calls Sightengine integration (if configured)
  - stores checks history.
- Link checks:
  - URL extraction + normalization
  - caching + external scan integration (URL scanner service)
  - stores checks history.
- Consent gate for images (requires user consent for non-admins).
- Rate limiting middleware (basic anti-spam).

### Payments

- Telegram Stars payments in the bot:
  - records payment to `payments`
  - applies plan or credit pack to `users`.

### Admin Features (Admin + Owner)

- Admin commands: stats, ban/unban, give credits, set plan, broadcast, health.
- Feedback system:
  - `/feedback` user flow
  - inserts ticket into `feedback`
  - notifies the DB owner account (role=owner)
  - owner can reply/ignore.

### Owner-only “Power Features” (Hard RBAC)

Hard RBAC rule implemented: **access is granted only if `users.role === 'owner'`**.

- `/impersonate <telegram_user_id> [reason]` + `/impersonate_off`
  - in-memory session
  - auto-expire 30 minutes
  - logged to `impersonation_logs`
  - impersonation is enforced as **read-only** (no credits consumed, no writes to checks/history).
- `/forcegroup <group_id> <plan> <days>` and `/unforcegroup <group_id>`
  - updates `groups.plan` and `groups.premium_until`
  - logs to `admin_logs`.
- `/refund <payment_uuid> <reason>`
  - logical refund (DB-side)
  - revokes entitlement when safe
  - logs to `admin_logs`.
- Abuse simulation:
  - `/simulate_abuse <user_id> <type> <count>`
  - `/simulate_abuse_reset <user_id>`
  - writes simulated `abuse_flags` (`is_simulated=true`) and runs enforcement.
- Debug analytics commands:
  - `/timeline <telegram_user_id>`
  - `/groupmap` (via `group_heatmap` view)
  - `/flag …` feature flag management (global/user/group scopes).

### TMA (Mini App)

- Static UI:
  - account/credits view
  - history list
  - premium page.
- Express backend:
  - validates Telegram init data via `X-Telegram-Init-Data`
  - provides endpoints for profile, checks, role, and Razorpay order creation.

## Major Fixes Implemented During This Build

- Credits mismatch:
  - `daily_credits` column added and reset logic aligned.
  - TMA stopped showing “fake 3 credits” on API failure.
- Checks history mismatch:
  - bot now writes `checks.user_id` as `users.id` UUID (not telegram id).
  - `/history` uses UUID correctly.
- Feedback delivery:
  - restored feedback text capture + owner notification.
- Security:
  - removed tracked `.env` from repo and added recursive `.env` ignores.

## What’s Partially Built / Needs Completion

### Group Mode (MVP gaps)

- Group protection exists only as a stub:
  - bot currently blocks most non-private processing.
  - group tagging-based checks (“tag the bot”) and group autoscan are not fully implemented.
- `/linkgroup` exists and stores the group record, but group enforcement + autoscan loop are not end-to-end.

### Razorpay End-to-End

- TMA has Razorpay endpoints and webhook handling code paths, but production readiness depends on:
  - correctly configured env vars on Vercel
  - proper webhook verification and idempotency
  - aligning payments→entitlements with the DB schema fields used by the bot.

### Legal / Compliance

- Legal docs exist in `Documents/BSChecker_Doc4_Legal.html` but:
  - not published as URLs
  - not wired into a `/legal` bot command.

### QA + Monitoring

- The spec suite includes a full QA checklist (Doc 12), but it is not tracked as automated tests.
- No Sentry/centralized monitoring integration in code yet.

## Known Spec Deviations (From Original Docs)

- Spec mentions `/legal`, `/settings`, `/groupsetup`, `/autoscan`, `/groupstats`:
  - these are not fully implemented in the bot.
- Spec suggests Python handler patterns; implementation is Node/TypeScript.
- Spec describes group usage heavily; current implementation is primarily private-chat MVP.

## Current Risks / Hot Spots

- Role correctness: since owner RBAC is DB-only, ensure your owner user row exists and has `role='owner'`.
- Payment revocation safety: `/refund` revokes only when it looks safe (to avoid undoing a newer purchase); a dedicated entitlement model would remove ambiguity.
- Impersonation persistence: sessions are in-memory; bot restarts will clear impersonation state.

