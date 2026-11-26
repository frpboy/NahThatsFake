# NahThatsFake — Implementation Plan

**Repository:** github.com/frpboy/NahThatsFake (Telegram bot + Mini App for AI-image and scam-link checks)
**Status:** Planning document. No code changes are authorised by this plan alone; each item ships as its own PR with tests, in the pattern of PRs #459–#461.
**Basis:** An external roadmap review of the repo (Nov 2026), filtered through the owner's rules below, plus in-house findings from the Nov 25, 2026 production work. Every code reference below was verified against the local checkout; every GitHub issue number was verified live (see the Issue Index).

---

## 1. Governing rules (these override the source roadmap wherever they conflict)

1. **Free and non-profit, always.** The app charges users nothing and earns nothing. Only free tiers and open-source dependencies may be planned. No paid APIs, no paid SaaS upgrades, no commercial licences.
2. **Payments are disabled by design.** Premium purchase endpoints intentionally return HTTP 410 and must stay that way (`bot/tests/payment-shutdown.test.ts` and `tma/tests/purchase-disabled.test.js` guard this). All roadmap items about payment fulfilment, webhook idempotency, refunds, and reconciliation are **Deferred by design** — not P0. The only payment work in scope is keeping the shutdown airtight.
3. **Safe Browsing v4 stays.** Google Web Risk is a commercial product; migrating to it is out of scope while the app is non-commercial. The v4 deprecation note is recorded as a Future-phase watch item only.
4. **Pre-release, no real users yet.** Work is sequenced for correctness and trust first, scale last. Enterprise-scale items (Redis, public API, browser extension, threat-intelligence dashboard) live in Phase 5 (Future) and are not scheduled.
5. **Detection honesty is the product.** A check with insufficient evidence returns INCONCLUSIVE / "No verdict" — never a clean or LOW-risk result. This principle was established by PR #459 and governs every detection item in this plan.
6. **Modular monolith.** The existing bot + Mini App + Supabase structure stays. No microservices rewrite.
7. **No accuracy claims without evidence.** No percentage accuracy is advertised anywhere until the Phase 2 evaluation set produces measured numbers.

## 2. Already shipped — do not re-plan

| Work | Reference |
|---|---|
| Separate per-check results (image timeout ⇒ inconclusive, never a combined clean verdict; caption URLs run both checks) | PR #459 |
| Mini App server reads moved to the Supabase service-role client; DB errors return 500, 404 only for missing rows | PR #460 |
| Bot Docker image bumped to Node 22 (fixed the Supabase WebSocket crash-loop) | PR #461 |
| Bot actually hosted: GCP e2-micro VM `nahthatsfake-bot` (us-central1-a), Docker, `/opt/nah-thats-fake`; Mini App on Vercel | Ops, Nov 25 2026 |
| Provider-coverage honesty for URL scans (`getScanCoverage` in `bot/src/services/urlscanner.ts`: missing coverage throws inconclusive instead of returning LOW) | In `main` |

---

## Phase 1 — Stabilise & detection honesty

Owner priority order for this phase: items 1.1–1.2 are priority #1, 1.4 is priority #2, 1.5 is priority #3. Item 1.3 is an early quick win diagnosed in-house.

### 1.1 VirusTotal analysis-completion check

- **Goal:** A VirusTotal verdict is only issued from a *completed* analysis. A queued/in-progress analysis is treated as no evidence (INCONCLUSIVE), never as clean stats.
- **Problem (verified in code):** In `checkVirusTotal()` (`bot/src/services/urlscanner.ts`), when no existing report exists, the code submits the URL, sleeps a fixed 2 s, then reads `attributes.stats` **without checking `attributes.status`**. A pending analysis can return empty/zero stats, which downstream reads as "0 malicious". The existing-report path likewise trusts `last_analysis_stats` without checking it is populated.
- **Work steps:**
  1. After submitting a URL, poll `GET /analyses/{id}` with a bounded retry (e.g. up to ~20 s total, backoff) until `attributes.status === 'completed'`; on timeout, throw so the provider counts as not-run.
  2. Validate the stats object on both paths: required numeric fields present and finite; an all-zero stats block from an incomplete/empty analysis is not accepted as evidence.
  3. Let the existing `getScanCoverage()` logic do its job: VT-not-completed ⇒ provider not counted ⇒ scan resolves to partial/inconclusive per current rules, never LOW on missing evidence.
  4. Apply the same completion discipline anywhere else VT analysis results are consumed (search for other `/analyses/` callers during implementation).
- **Files/areas:** `bot/src/services/urlscanner.ts`; tests in `bot/tests/urlscanner.test.ts` (extend the existing provider-stub pattern); result wording via `bot/src/services/separateResults.ts` if a new state needs rendering.
- **Acceptance tests:**
  - Stubbed VT analysis stuck at `queued`/`in-progress` ⇒ `checkUrlSafety` does not return LOW; it throws/resolves inconclusive exactly as a provider outage does today.
  - Stubbed analysis completing on the 3rd poll ⇒ stats are used and the verdict is issued.
  - Stubbed completed analysis with malformed stats (missing fields) ⇒ treated as provider failure, not as 0 malicious.
  - Existing `test:urlscanner` suite still passes.
- **Issues:** **New** — no existing issue covers VT completion. Create one when implementation starts (do not create yet).

### 1.2 Image provider response validation (Sightengine)

- **Goal:** A malformed, error, or incomplete Sightengine response can never become a LOW-risk image verdict.
- **Problem (verified in code):** `detectDeepfake()` (`bot/src/services/sightengine.ts`) never checks `data.status`, and reads `data.scores.synthetic` / `data.scores.human` unguarded. If `scores` is absent, the score is `undefined`, both threshold comparisons fail, and the function returns `risk_level: 'LOW'` — a fabricated clean verdict from an invalid response.
- **Work steps:**
  1. Require `data.status === 'success'`; anything else throws a provider error (preserving the existing timeout ⇒ inconclusive behaviour from PR #459).
  2. Validate `scores.synthetic` and `scores.human`: present, numeric, finite, within [0, 1]. Any violation throws.
  3. Confirm the throw path surfaces to the user as an inconclusive image check (null score, "No verdict"), consistent with the timeout path in `bot/src/handlers/image.ts`.
- **Files/areas:** `bot/src/services/sightengine.ts`; `bot/src/handlers/image.ts` (error surfacing); **new** test file `bot/tests/sightengine.test.ts` (none exists today).
- **Acceptance tests:**
  - Response with `status: 'error'` ⇒ throws; handler renders inconclusive, not LOW.
  - Response missing `scores`, or with a non-numeric / out-of-range score ⇒ throws; no verdict issued.
  - Valid response ⇒ score, risk level, and confidence computed as today.
- **Issues:** **New** — create when implementation starts.

### 1.3 Admin Dashboard stats resilience

- **Goal:** The Mini App Admin Dashboard (`/api/admin/stats`) shows the counts it *can* compute instead of failing entirely when one sub-query fails.
- **Problem (diagnosed Nov 25, 2026):** In `tma/server.js` (line ~247), the endpoint runs four sub-queries via `Promise.all` — user count, banned count, checks count, and `.rpc('get_total_revenue')` — and throws `'Database error'` if **any** one errors, so all tiles render "—". The revenue RPC is the prime suspect: `get_total_revenue()` is defined in `supabase/migrations/20240531000000_calculate_revenue_rpc.sql`, but the repo's migration history is known not to replay cleanly, so the function may not exist in the production database.
- **Work steps:**
  1. Verify against the production DB whether `get_total_revenue()` exists and executes; if missing, apply just that migration and record it.
  2. Restructure the endpoint: settle each sub-query independently (`Promise.allSettled` pattern), log *which* sub-query failed server-side, return the successful counts, and mark failed fields explicitly (e.g. `null` + an `errors` list) instead of a blanket 500.
  3. Frontend: render "—" only for the failed tile(s), real numbers for the rest.
- **Files/areas:** `tma/server.js`; `tma/tests/` (extend the request-level tests, pattern of `service-role-reads.test.js`); possibly `supabase/migrations/20240531000000_calculate_revenue_rpc.sql` (application only, no rewrite).
- **Acceptance tests:**
  - With the revenue RPC stubbed to fail, the endpoint returns 200 with correct user/banned/checks counts and revenue marked unavailable.
  - With all sub-queries healthy, output is unchanged from today.
  - Non-admin callers still get 403; unauthenticated still 401.
- **Issues:** **New** (in-house diagnosis) — create when implementation starts.

### 1.4 Atomic credit consumption

- **Goal:** One credit buys at most one check, even under concurrent requests; a check that ends inconclusive or provider-down never costs the user a credit.
- **Problem (verified in code):** `consumeCredit()` (`bot/src/utils/credits.ts`) reads the balance, then writes `balance - 1` from the stale read — two simultaneous requests can both spend the same credit. It also ignores the update's returned error. Separately, handlers debit *before* scanning, so a scan that throws leaves the credit spent (this is exactly issue #410).
- **Work steps:**
  1. Add a Postgres function (new migration in `supabase/migrations/`) that debits daily-then-permanent credits atomically in a single statement/transaction and returns the source consumed (`daily` | `permanent` | `none`); owner/premium bypass stays in code as today.
  2. Add an idempotency key per check request (e.g. Telegram update/message id + check type) so a retried request cannot debit twice.
  3. Move to a reserve/settle shape: reserve at request start; settle on a delivered verdict; release on inconclusive/provider failure — closing the #410 credit-loss path.
  4. Add a `credit_transactions` ledger table (user, delta, source, reason, check id, timestamp) written inside the same transaction.
  5. Rewrite `consumeCredit()` to call the RPC and check its error; update call sites in `bot/src/handlers/link.ts` and `bot/src/handlers/image.ts`.
- **Files/areas:** `supabase/migrations/` (new function + ledger table); `bot/src/utils/credits.ts`; `bot/src/handlers/link.ts`; `bot/src/handlers/image.ts`; new tests under `bot/tests/`.
- **Acceptance tests:**
  - Concurrency test: two simultaneous consume calls against a 1-credit balance ⇒ exactly one succeeds.
  - Duplicate idempotency key ⇒ second call is a no-op returning the original result.
  - Scan stubbed to end inconclusive ⇒ balance unchanged and a release entry exists in the ledger.
  - Every debit/refund writes exactly one ledger row.
- **Issues:** **Existing #410** — "Prevent credit loss when URL scans are inconclusive or unavailable" (open, verified). The atomicity + ledger work is the fix path for #410; reference it in the PR rather than opening a duplicate.

### 1.5 Abuse-flag and enforcement error checking

- **Goal:** The bot never claims a flag was recorded or a ban/throttle applied unless the database write actually succeeded.
- **Problem (verified in current code):** `flagUser()` (`bot/src/services/abuseDetection.ts`, line ~11) awaits the `abuse_flags` insert without destructuring its `error`, then proceeds to enforcement. `checkAbuseAndEnforce()` (`bot/src/services/abuseEnforcement.ts`, lines ~63/76/90) sets `actionTaken` and writes a success audit log after `users` updates whose errors it never inspects.
- **Verify first (required):** The Oct 2026 migrations (`supabase/migrations/20261028000000_harden_abuse_flags_insert_policy.sql`) hardened the abuse-flags *RLS policy* — that is about who may insert, not about error handling. Before changing code, reproduce both behaviours against the current build and confirm which parts of #414/#416 are still live; do not assume the migrations fixed the application-level bug.
- **Work steps:**
  1. Check the insert result in `flagUser()`; on error, log it and do not proceed as though the flag persisted (surface per issue #414's required behaviour).
  2. Check every enforcement update in `checkAbuseAndEnforce()`; only set `actionTaken`, write the audit entry (`bot/src/utils/adminLogger.ts`), and notify on confirmed success; on failure, log an explicit enforcement-failure event.
  3. Add tests with a stubbed Supabase client returning errors.
- **Files/areas:** `bot/src/services/abuseDetection.ts`; `bot/src/services/abuseEnforcement.ts`; `bot/src/utils/adminLogger.ts`; new tests under `bot/tests/`.
- **Acceptance tests:**
  - Insert returns an error ⇒ no enforcement run is triggered by that flag, and the failure is logged.
  - Ban update returns an error ⇒ no success audit entry, no "banned" user-facing/admin message; failure is logged as an enforcement failure.
  - Happy path unchanged: flag persists, enforcement applies, audit entry written once.
- **Issues:** **Existing #414** — "Handle Supabase insert failures before claiming abuse flags were recorded" (open, verified); **Existing #416** — "Verify abuse-enforcement writes before reporting bans or throttles" (open, verified).

---

## Phase 2 — Detection intelligence

Owner priorities #4 and #5 land here, immediately after Phase 1.

### 2.1 Sightengine deepfake model as a separate second image result

- **Goal:** AI-generation and face-manipulation are reported as two independent results, because they are different detection problems — the same separation PR #459 applied to image vs link.
- **Problem (verified in code):** `detectDeepfake()` (`bot/src/services/sightengine.ts`) only requests `models: 'genai'` (AI-generated/edited detection) despite its name; Sightengine's dedicated `deepfake` model (swapped/manipulated faces) is never called. Also, the displayed `confidence` is `Math.max(scores.synthetic, scores.human)`, which is not a calibrated confidence and must not be presented as one.
- **Work steps:**
  1. Call Sightengine with both models (`genai` and `deepfake`) — one request if the API supports the combined model list, two otherwise — with per-model timeout handling so one model's failure makes only that result inconclusive.
  2. Validate each model's response with the Phase 1.2 validation before use.
  3. Extend the result model (alongside `bot/src/services/separateResults.ts`) so a photo check carries two independent entries: "AI-generated" and "Face manipulation", each with its own score/verdict or INCONCLUSIVE.
  4. Update bot rendering (`bot/src/handlers/image.ts`) and the Mini App display to show both results separately; neither is ever merged into a single verdict.
  5. Cache per model: `check_cache` rows are keyed by `api_source` today — store each model's result under its own source label.
  6. Define in plain language what each displayed score means (provider score, not a probability of guilt) and remove/relabel the `Math.max(...)` "confidence" so the UI never overstates it.
- **Files/areas:** `bot/src/services/sightengine.ts`; `bot/src/handlers/image.ts`; `bot/src/services/separateResults.ts`; `bot/tests/separate-results.test.ts` + the new `bot/tests/sightengine.test.ts`; Mini App result rendering in `tma/`.
- **Acceptance tests:**
  - Stubbed genai-only success + deepfake timeout ⇒ AI-generated result shown, face result INCONCLUSIVE, no combined verdict.
  - Both models succeed ⇒ two distinct results rendered with distinct labels.
  - Cached second check returns both stored results without new API calls.
- **Issues:** **New** — create when implementation starts.

### 2.2 QR code scam detection

- **Goal:** A user can send a photo of a QR code; the bot decodes it, extracts the destination, and runs it through the existing URL scanner with a clear explanation.
- **Current state (verified):** No QR decoding dependency exists anywhere in the repo (`bot/`, `tma/`, root `package.json` checked). This is a genuinely new capability.
- **Work steps:**
  1. Add a free, open-source decoder (e.g. `jsqr` over the decoded image buffer, with an image-decoding helper such as `pngjs`/`jpeg-js`, or an equivalent OSS stack — evaluate against the bot's existing image pipeline first).
  2. In the photo flow (`bot/src/handlers/image.ts`), attempt QR decoding alongside/independent of the image check; a photo can yield both an image result and a QR result, shown separately.
  3. Classify the payload: URL ⇒ run `checkUrlSafety()` unchanged; payment URI (e.g. `upi://`) ⇒ show the destination prominently with a caution, never a "safe to pay" claim; other text ⇒ display it verbatim as untrusted content.
  4. Credit behaviour matches other checks (one check = one atomic debit under Phase 1.4 rules; inconclusive ⇒ no debit).
- **Files/areas:** new `bot/src/services/qr.ts`; `bot/src/handlers/image.ts`; `bot/package.json` (dependency); new tests `bot/tests/qr.test.ts` with fixture images.
- **Acceptance tests:**
  - Fixture QR encoding a benign URL ⇒ decoded and scanned; result shows the destination URL.
  - Fixture QR encoding a UPI payment URI ⇒ destination shown with caution wording; no safety verdict claimed.
  - Photo with no QR ⇒ image flow unchanged, no QR section rendered.
  - Blurry/undecodable QR ⇒ reported as "couldn't read a QR code", not an error crash.
- **Issues:** **New** — create when implementation starts.

### 2.3 Evaluation set and honest score semantics

- **Goal:** Detection quality is measured on a small maintained sample set before any quality claim is made, and every displayed number has a defined meaning.
- **Work steps:**
  1. Assemble a starter evaluation set (genuine photos, AI-generated, AI-edited, face-swapped, social-media-compressed, screenshots, low-resolution) with expected categories, stored outside the shipped bundle with a runner script.
  2. Record per-category outcomes (correct / false-positive / false-negative / inconclusive) for both image models and the URL scanner after each detection change.
  3. Document the meaning of each displayed score in the result copy (provider signal strength, coverage, and limits), following the "honest limits" framing already used in the app's own artwork.
- **Files/areas:** new `evaluation/` directory (fixtures + runner); result copy in `bot/src/services/separateResults.ts` and Mini App strings.
- **Acceptance tests:** Runner executes end-to-end against stubbed providers in CI-style runs and against live providers manually; a short results note is produced per run. No numeric accuracy is published from a single run.
- **Issues:** **New** — create when implementation starts.

---

## Phase 3 — Infrastructure & ops

### 3.1 CI workflow

- **Goal:** Every PR runs the repo's real checks automatically.
- **Current state (verified):** `.github/` contains only `dependabot.yml` — no workflows. The root `package.json` test script has already been fixed since issue #401 was filed (it now runs the TMA tests and all four bot suites), so the remaining gap is the Actions workflow itself.
- **Work steps:** Review and land the already-open **PR #409** ("ci: add repeatable repository checks and TMA smoke tests", branch `ci/401-reliable-root-checks`); adjust it to run on Node 22 (matching PR #461) — bot build + typecheck, all bot test suites, TMA `node --test` suite, and a Docker build check for `bot/Dockerfile`. Pin third-party actions to commit SHAs; least-privilege workflow permissions.
- **Files/areas:** `.github/workflows/`; root `package.json` scripts if gaps remain.
- **Acceptance tests:** A deliberately failing test on a scratch branch fails the workflow; a green main run passes all suites.
- **Issues:** **Existing #401** — "CI reliability: add repeatable checks and replace placeholder root test command" (open, verified); **Existing PR #409** (open, verified) is the vehicle — prefer landing it over writing a new workflow.

### 3.2 Lint that actually runs

- **Goal:** `npm run lint` in `bot/` works from a clean install.
- **Work steps:** Add ESLint + TypeScript ESLint packages and a checked-in flat config sized to the codebase; wire lint into CI (3.1) as a non-blocking-then-blocking step.
- **Files/areas:** `bot/package.json`, `bot/package-lock.json`, new `bot/eslint.config.*`.
- **Acceptance tests:** Clean `npm ci` followed by `npm run lint` executes and reports; CI job runs it.
- **Issues:** **Existing #408** — "Fix bot lint command with a reproducible, locked ESLint setup" (open, verified).

### 3.3 One package manager, one lockfile

- **Goal:** Root, `bot/`, and `tma/` each track exactly one lockfile for one canonical package manager.
- **Work steps:** Pick npm (the Docker and Vercel builds already resolve npm lockfiles — confirm during implementation), delete the competing `pnpm-lock.yaml` files, set `packageManager` in each `package.json`, and document the choice in the setup docs (3.6).
- **Files/areas:** `package.json`, `bot/package.json`, `tma/package.json`, all lockfiles, `bot/Dockerfile`, `tma/Dockerfile`.
- **Acceptance tests:** Fresh clone ⇒ one documented install command per package succeeds; Docker builds still pass; Dependabot config matches the chosen manager.
- **Issues:** **Existing #373** — "chore/security: standardize lockfiles across root, bot, and TMA" (open, verified).

### 3.4 Branch protection

- **Goal:** `main` cannot be pushed to directly; changes land via reviewed PRs with green CI.
- **Work steps:** After 3.1 is live, enable branch protection/ruleset on `main`: require PR, require the CI checks, block force-push and branch deletion. (Settings change, done by the owner in GitHub UI; this plan only specifies the settings.)
- **Acceptance tests:** A direct push to `main` is rejected; a PR without green CI cannot merge.
- **Issues:** **Existing #400** — "Repository governance: protect the default branch and require reviewed, validated changes" (open, verified).

### 3.5 URL-scanner security audit (#391) + image-download hardening

- **Goal:** Close the open security audit with evidence, and bound the resources a submitted image can consume.
- **Current state (verified):** The scanner itself never fetches user URLs server-side — it only forwards them to Google Safe Browsing and VirusTotal — so classic SSRF is largely not applicable today; the audit must confirm this by tracing, and must gate any *future* feature that does fetch (QR redirect resolution, link previews). Separately, `bot/src/handlers/image.ts` calls `ctx.api.getFile(fileId)` (line ~80) with no visible file-size or download limits.
- **Work steps:**
  1. Trace and document every URL parse/normalisation/outbound request (#391 checklist: scheme allowlist, embedded credentials, private/reserved IPs, redirect handling, timeouts, response-size limits, IDN/shortened URLs). Record "not applicable — no server-side fetch" per item where true, with the code reference.
  2. Privacy: confirm submitted URLs (which can contain tokens/reset links) are not written to logs — the scanner already avoids logging credential-bearing request URLs; extend the same check to handlers.
  3. Image downloads: enforce max file size (reject oversized Telegram files before download), download timeout, MIME/signature sanity check against supported formats, and guaranteed buffer cleanup after processing.
- **Files/areas:** `bot/src/services/urlscanner.ts`; `bot/src/handlers/link.ts`; `bot/src/handlers/image.ts`; findings recorded on the issue.
- **Acceptance tests:** Oversized-file fixture is rejected before download; non-image payload with an image extension is rejected; audit checklist on #391 is answered item-by-item with code references.
- **Issues:** **Existing #391** — "Security: audit URL scanner for SSRF, DNS rebinding, redirects, and resource limits" (open, verified). Image-download hardening is **new** — fold into #391's thread or create a companion issue at implementation time.

### 3.6 Documentation consolidation

- **Goal:** One authoritative set of docs; historical AI-generated launch documents stop masquerading as operational truth.
- **Problem (proven in production work, Nov 25 2026):** `BOT_DEPLOYED.md`, `DEPLOYMENT_COMPLETE.md`, and `DEPLOY_NOW.md` claim a running GCP deployment with placeholder tokens — the bot in fact had no working host until the VM was created that day. `Documents/Project_Status_Report.md` dates from Feb 2026 and no longer reflects the system.
- **Work steps:**
  1. Move `BOT_DEPLOYED.md`, `DEPLOYMENT_COMPLETE.md`, `DEPLOY_NOW.md`, and the stale status report into an `archive/` folder (or add a prominent "SUPERSEDED — historical, not operational" banner), keeping them for history.
  2. Make `README.md` + `GCP_VERCEL_DEPLOY.md` (updated to the real topology: bot on the `nahthatsfake-bot` VM via Docker Compose, Mini App on Vercel) the authoritative deployment docs; reconcile `DEPLOYMENT.md` / `DEPLOY_INSTRUCTIONS.md` against them and archive duplicates.
  3. Add the missing governance docs, short and factual: `CONTRIBUTING.md`, `SECURITY.md` (disclosure route), `DEVELOPMENT.md` (local setup incl. the canonical package manager from 3.3), `OPERATIONS.md` (how the VM is restarted, where logs live, the runbook used on Nov 25).
  4. Record the migration discipline rule in `DEVELOPMENT.md`: the full `supabase/migrations/` directory does **not** replay cleanly (per the README warning) — new migrations are applied individually and recorded; RPC function definitions live in migrations (note: `fulfill_payment`'s SQL was never located in the repo — see #390; it stays un-investigated while payments are disabled, and this gap is documented rather than silently left).
- **Files/areas:** repo root docs; `Documents/`; `README.md`.
- **Acceptance tests:** A fresh reader following only non-archived docs reaches a correct mental model (topology, setup, deploy) with no placeholder credentials presented as real; every archived file is visibly marked.
- **Issues:** **New** — create when implementation starts.

### 3.7 Monitoring basics (free-tier sized)

- **Goal:** Know within minutes, not from a user screenshot, when the bot or Mini App is down.
- **Work steps:**
  1. Uptime check on the Mini App health endpoint and a bot liveness signal (the bot writes a heartbeat row/timestamp to Supabase on an interval; a free-tier external uptime monitor — e.g. UptimeRobot free — polls the health endpoint and alerts on failure).
  2. A simple watchdog on the VM (systemd timer or cron) that checks the bot container is up and not restart-looping, and restarts it if dead — the Nov 25 crash-loop would have been caught by this.
  3. Error visibility: structured `console.error` logs are already the pattern; add a weekly manual log review to `OPERATIONS.md` rather than a paid error platform. (Sentry's free tier is an acceptable optional addition if the owner wants it; it is not required.)
  4. Alert routing: alerts go to the owner only (email/Telegram), no paid paging services.
- **Files/areas:** VM crontab/systemd; `tma/server.js` health route (verify current behaviour first); `OPERATIONS.md` (3.6).
- **Acceptance tests:** Stopping the bot container in a drill produces an alert and an automatic restart; taking the health endpoint down produces an uptime alert.
- **Issues:** **New** — create when implementation starts.

### 3.8 Migration discipline (lightweight)

- **Goal:** Know exactly which migrations the production database has, so Phase 1.3-style surprises stop recurring.
- **Work steps:** Produce a one-page inventory reconciling `supabase/migrations/` against the production DB (which functions/tables actually exist — starting with `get_total_revenue`); from then on, apply new migrations individually with a dated note in `OPERATIONS.md`. No staging database or automated migration CI in this phase (pre-release scale).
- **Acceptance tests:** The inventory exists and correctly predicts the presence/absence of five spot-checked objects.
- **Issues:** **New** — or fold into 3.6's documentation issue at implementation time.

---

## Phase 4 — Product

Sequenced after Phases 1–3; each item needs its own design pass before building.

### 4.1 Suspicious-message analysis
Forwarded-message checking: rules-based indicators (urgency, OTP requests, impersonation, prize/loan/investment patterns) combined with the existing provider stack; output lists the *specific indicators found*, never an unexplained percentage. Files: new `bot/src/services/messageScan.ts`, bot handlers. **New issue required.**

### 4.2 Group protection completion
`bot/src/handlers/group.ts` exists (115 lines) but group-mode enforcement is incomplete per the project status report. Scope: automatic link scanning in groups, warn-first defaults, admin-configurable thresholds, incident log; never auto-ban a user solely on one provider flag. **New issue required** (verify no existing group-mode issue first).

### 4.3 False-positive / false-negative reporting
"Report an incorrect result" on every verdict, feeding a simple owner moderation queue (Supabase table + admin view in the Mini App). Reports are never auto-trained on. **New issue required.**

### 4.4 Shareable investigation reports
Each check gets a privacy-conscious shareable view: check id, timestamp, category, per-provider results, coverage, limitations — with the original sensitive URL and the reporter's Telegram identity redacted. Builds on the Phase 2.1 result model. **New issue required.**

### 4.5 Mini App dashboard restructure
Reorganise the Mini App around Scan / Protection (activity) / History / Account, with separate image & link results (already the PR #459 behaviour), provider-unavailable states, retry on inconclusive, and history deletion. Includes the Phase 1.3 stats fix as a prerequisite for the admin view. **New issue required.**

### 4.6 Multilingual support
English, Malayalam, Hindi for bot replies and Mini App strings, externalised into locale files. Sized for the owner's actual audience. **New issue required.**

### 4.7 Domain intelligence (free-data edition)
Per-domain report built only from free sources already in the stack: provider verdicts + timestamps, URL/host parsing signals (lookalike/IDN homograph heuristics computed locally), and TLS presence noted *without* treating HTTPS as legitimacy. No paid WHOIS/reputation APIs. **New issue required.**

---

## Phase 5 — Future (not scheduled; revisit only if the app gains real users or changes model)

- Browser extension (Chrome/Firefox) for pre-click link checks.
- Public developer API for the detection stack.
- Public threat-intelligence dashboard (aggregated, privacy-safe statistics).
- Domain-monitoring subscriptions (impersonation/reputation alerts).
- Voice and video synthetic-media detection (research first; provider costs must fit the free rule or the item stays here).
- Distributed rate limiting (Redis or equivalent) — only if multi-instance deployment ever happens; a Postgres-RPC limiter is the ceiling for current scale.
- Google Web Risk migration — only if the app ever becomes commercial, which would also reopen the payments questions below.
- Full evaluation/accuracy programme beyond the Phase 2.3 starter set.

---

## Out of scope — explicit

| Item | Why |
|---|---|
| Payment fulfilment, webhook idempotency, refunds, reconciliation (roadmap P0-B; **existing issue #390** — "Security: prove payment fulfilment is idempotent across callbacks and webhooks") | **Deferred by design — payments are intentionally disabled (HTTP 410).** #390 stays open as a record; the only in-scope payment work is keeping the shutdown tests green. Revisit only if the owner ever decides to enable payments. |
| Google Web Risk migration | Commercial API; conflicts with the free/non-profit rule. Safe Browsing v4 stays. |
| Any paid service or paid tier (hosting beyond the free e2-micro, paid WHOIS/reputation data, paid monitoring/paging) | Free-tiers-only rule. |
| Microservices / backend rewrite | Modular monolith is sufficient at pre-release scale. |
| Advertising-network expansion (Adsgram is present in code) | Not part of this plan; monetisation questions are the owner's separate decision and conflict with the current non-profit framing until decided. |
| Creating GitHub issues from this plan | Deliberately deferred — issues are created per item when its implementation starts, after a duplicate check, so the tracker doesn't fill with stale plans. |

---

## Issue index (verified live, Nov 25 2026)

| Ref | State | Title | Plan item |
|---|---|---|---|
| #410 | Open | Prevent credit loss when URL scans are inconclusive or unavailable | 1.4 |
| #414 | Open | Handle Supabase insert failures before claiming abuse flags were recorded | 1.5 |
| #416 | Open | Verify abuse-enforcement writes before reporting bans or throttles | 1.5 |
| #391 | Open | Security: audit URL scanner for SSRF, DNS rebinding, redirects, and resource limits | 3.5 |
| #401 | Open | CI reliability: add repeatable checks and replace placeholder root test command | 3.1 |
| PR #409 | Open | ci: add repeatable repository checks and TMA smoke tests | 3.1 |
| #408 | Open | Fix bot lint command with a reproducible, locked ESLint setup | 3.2 |
| #373 | Open | chore/security: standardize lockfiles across root, bot, and TMA | 3.3 |
| #400 | Open | Repository governance: protect the default branch and require reviewed, validated changes | 3.4 |
| #390 | Open | Security: prove payment fulfilment is idempotent across callbacks and webhooks | Out of scope (deferred by design) |

**Genuinely new items (no existing issue — create at implementation time):** VT analysis-completion (1.1), image provider validation (1.2), admin stats resilience (1.3), deepfake as separate result (2.1), QR detection (2.2), evaluation set (2.3), image-download hardening (3.5 companion), docs consolidation (3.6), monitoring basics (3.7), migration inventory (3.8), and all Phase 4 items (4.1–4.7).

## Sequencing summary

Phase 1 (1.1 → 1.5, with 1.3 slotted early as a quick win) → Phase 2 (2.1, 2.2, 2.3) → Phase 3 (3.1 first, since CI protects everything after it) → Phase 4 by owner choice → Phase 5 unscheduled. Every item: branch → tests → PR → merge → verify on the deployed artifact (the VM for bot changes, Vercel for Mini App changes), never on a version file or a doc's claim.

---

## Phase 2 — detailed plan

Phase 1 completed and went live on 26 Nov 2026 (main `b237607`). The detailed,
build-ready Phase 2 plan — design, exact API/response fields, QR library
choice, evaluation-set design, credit integration, tests, rollout order, a
Definition of Done, and five open questions for the owner — lives in
[PHASE_2_PLAN.md](sandbox://workspace/goals/nahthatsfake-production-readiness/files/PHASE_2_PLAN.md)
(`~/workspace/goals/nahthatsfake-production-readiness/files/PHASE_2_PLAN.md`).
The Phase 2 sketch in this document remains the summary; PHASE_2_PLAN.md is
the document to build from.
