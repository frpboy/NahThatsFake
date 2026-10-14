# NahThatsFake — Spec vs Implementation Comparison

Date: 2026-02-24

This report compares the original spec suite in `Documents/BSChecker_Doc*.html` against the current repository implementation.

Legend:
- ✅ Implemented
- 🟡 Partially implemented
- ❌ Not implemented
- 🔁 Implemented but differs

## Doc 01 — PRD / Rules / Pricing

Key goals (MVP Phase 1): image + link detection, 3 free daily checks, referral credits, premium upsell.

- ✅ Image detection exists (Sightengine integration).
- ✅ Link scanning exists (URL scanning service + caching).
- ✅ Daily credits (3/day) exist (via `users.daily_credits`).
- ✅ Permanent credits exist (referrals + credit packs).
- 🟡 Group-first “tag anywhere” behavior is not fully shipped (group mode is mostly gated).
- 🔁 Copy/tone: implementation has been refined from spec wording.

## Doc 02 — Design / Flows / Detection Logic

- ✅ Private chat flows for onboarding, image check, link check are present.
- 🟡 Full decision-tree style responses (breakdowns, EXIF messaging, multi-detector scoring) are simplified in code.
- 🟡 Group flows (tagging, in-group replies, autoscan loops) are incomplete.

## Doc 03 — Payments & Premium

- ✅ Telegram Stars flow implemented in bot.
- ✅ Razorpay integration exists in TMA backend.
- 🟡 Full lifecycle nuances from spec:
  - grace periods
  - reconciliation dashboards
  - failed payment recovery
  - automated refunds
  are not fully built.
- ✅ Owner-only logical refund (`/refund`) added (not in original spec suite).

## Doc 04 — Legal

- 🟡 Legal text exists in Documents, but not operationalized:
  - not published at URLs
  - no `/legal` command wiring
  - consent flow is present for images, but not linked to published legal pages.

## Doc 05 — Brand

- 🟡 UI and bot copy is close to the intended tone, but brand system is not enforced as a design system.
- 🟡 Some emoji/copy rules differ in practice.

## Doc 06 — Growth

- ✅ Referral system exists.
- ✅ AdsGram `/earn` monetization added.
- 🟡 Growth analytics + KPI dashboard is not implemented (no metrics view beyond basic `/stats`).

## Doc 07 — Security & Ethics

- ✅ Telegram initData verification exists in the TMA backend.
- ✅ Repo no longer tracks `.env` files.
- 🟡 Full checklist items are not implemented:
  - dedicated monitoring (Sentry)
  - structured audit logging across all flows
  - complete RLS coverage review
  - abuse analytics separation (simulated flags exclusion is planned, not yet enforced in queries).

## Doc 08 — Telegram Commands Spec

Implemented commands (high level):
- ✅ `/start`, `/check`, `/credits`, `/refer`, `/history`, `/premium`, `/help`
- ✅ `/feedback` (user flow) + owner reply/ignore
- ✅ Admin: `/admin`, `/stats`, `/ban`, `/unban`, `/givecredits`, `/setplan`, `/broadcast`, `/health`

Not/partial vs spec:
- ❌ `/legal`
- ❌ `/settings` (TMA deep link exists but no dedicated command)
- 🟡 `/groupsetup`, `/autoscan`, `/groupstats` (group functionality is partial; linking exists as `/linkgroup`)

Owner-only (new spec you provided, now implemented):
- ✅ `/impersonate`, `/impersonate_off`, enhanced `/whoami`
- ✅ `/forcegroup`, `/unforcegroup`, `/refund`
- ✅ `/simulate_abuse`, `/simulate_abuse_reset`, `/timeline`, `/groupmap`, `/flag`

## Doc 09 — API Contracts

- ✅ Telegram Bot API usage (file downloads, messaging).
- ✅ Sightengine integration pattern present.
- ✅ Supabase integration present.
- 🟡 Google Safe Browsing / VirusTotal: code exists under url scanning services, but reliability depends on env keys and rate limits.
- 🟡 Razorpay: backend code exists; production readiness depends on webhook + idempotency hardening.

## Doc 10 — Database Schema

- ✅ Core tables exist: users, checks, check_cache, payments, referrals, groups, abuse_flags.
- ✅ Additional tables exist: admin_logs, feedback.
- ✅ Added in implementation:
  - `users.daily_credits` (needed for credit system)
  - `impersonation_logs`
  - `feature_flags`
  - `abuse_flags.is_simulated`
  - `group_heatmap` view

Notes:
- 🔁 Some constraints differ from the February draft docs (plans expanded beyond the original subset).

## Doc 11 — TMA Spec

- ✅ Telegram SDK initData pattern implemented in frontend + verified in backend.
- ✅ Key screens exist (account, checks, premium page).
- 🟡 Full “8 screen” spec is not completely implemented; current app is a functional subset.
- 🔁 Frontend is Vanilla JS, which is allowed by spec (React optional).

## Doc 12 — QA Checklist

- ❌ Full QA checklist is not automated.
- 🟡 Some flows have been exercised manually during fixes, but not tracked as test cases.

## Doc 13 — Tracker

- 🟡 Many Phase 1 tasks are implemented, but several checklist items remain open:
  - public legal URLs
  - group scanning end-to-end
  - monitoring and release hardening
  - QA sign-off.

## Summary: What’s “MVP Ready” vs “Launch Ready”

MVP-ready for private chat:
- ✅ Image + link checks
- ✅ credits + referrals
- ✅ premium (Stars) and basic payment recording
- ✅ TMA account + history subset

Not yet “launch ready” per original docs:
- ❌ complete legal publishing + `/legal` integration
- 🟡 end-to-end Razorpay + reconciliation
- 🟡 group mode (tagging, autoscan, group stats)
- ❌ QA checklist execution + monitoring

