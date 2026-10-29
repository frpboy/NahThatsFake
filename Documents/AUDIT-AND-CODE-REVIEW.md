# Audit and Code Review

Repository: frpboy/NahThatsFake
Baseline SHA: 682aa8cfb72a15ee69dc796eba00e911d760b418
Status: PARTIAL — no security sign-off.

## Source-level candidate: issue #399
At baseline, bot/src/services/urlscanner.ts returned empty threat arrays or zero counts when provider credentials were missing or provider requests failed. Promise.allSettled then allowed a zero score to map to LOW. bot/src/handlers/link.ts could cache that result for seven days. This is source-level evidence of a failure path; independent runtime reproduction was not performed.

Draft remediation: PR #402, branch fix/url-scan-provider-failure-state, head 378d615c8c0f54ad02ce56ef58a1a75d13bb52be. It changes missing/failed providers to explicit failures, classifies coverage, prevents inconclusive scans from being presented as LOW, avoids caching partial results, versions the cache key and avoids logging credential-bearing request details. A 47-line test now uses dependency-injected provider result doubles and a dedicated test tsconfig. The actual Axios response/error paths, malformed/in-progress provider responses, cache writes and user-facing handler behavior remain unvalidated.

## Other open candidates
- #390: payment fulfilment idempotency; SQL/schema and concurrent delivery tests required.
- #391: SSRF/redirect/DNS boundaries; actual server-side URL-fetch path remains unverified.
- #388/#389: feedback RLS change merged, effective deployed grants not verified.
- #386/#387: Telegram validation/abuse controls merged, runtime tests not verified.
- #400: governance; branch protection detail endpoint returned 403.
- #401: CI reliability; PR #409 now replaces root placeholder checks and adds CI, but is unmerged and post-fix Vercel validation remains pending.
- #408: bot lint is not reproducible; ESLint and TS parser/configuration are missing from the bot manifest/lockfile.
- #410: PR #402's new inconclusive-scan path may debit credits before the provider call throws; the handler catch does not refund them.
- #411: PR #405 changes every .btn to “Processing...” for one payment attempt; Sourcery raised this concrete user-facing issue.

## Coverage ledger
| Area | Status | Limitation |
|---|---|---|
| Repository identity and baseline | Reviewed | GitHub metadata and recursive tree |
| Issues/PRs/branches | Inventory retrieved | Baseline snapshot on 2026-10-28: 15 issues, 388 PRs, 383 branches. Current snapshot on 2026-10-29: 17 issues, 393 PRs, 388 branches. Not every diff/review/check reviewed |
| URL scanner failure handling | Source reviewed; draft fix | No local test run or provider integration tests |
| Payment idempotency | Needs validation | #390; disposable DB/concurrency tests unavailable |
| URL SSRF | Needs validation | #391; isolated harness not run |
| RLS and effective grants | Partial | No disposable DB/live policy verification |
| Dependencies/SBOM/history secrets | Not completed | Scans not executed |
| CI/CD | Partial | PR #409 adds workflow on feature branch; GitHub Actions passes on Node 22/24; current Vercel preview pending |
| Accessibility/performance | Not completed | No systematic tests/performance run |
| Independent verification | Blocked | No separate reviewer available in this run |

## Checks actually run
- Paginated GitHub API inventory and metadata reads.
- Compare of PR #402 against baseline: 4 commits ahead, 0 behind; 4 changed files.
- Tests/build/lint/dependency scans/secret scan: not run; no local checkout available.
- PR #402 observed Vercel status: failure due to deployment rate limit, not a test result.

## Additional review of draft PR #402 (static review only)
- Current head: `62a6251dd3459f54a9c0b07323170911bb1cbbf5`; Vercel status is a deployment-rate-limit failure, CodeRabbit was skipped for the draft, and GitGuardian's secret scan succeeded for four commits. No code tests were run.
- The nested catch around VirusTotal's existing-report GET still submits the URL after any error, not only a confirmed 404/not-found. Timeout, 429, 5xx and network failures therefore take the submission path instead of being treated as unavailable.
- Google Safe Browsing defaults a missing `matches` property to an empty list; VirusTotal defaults missing stats to zero and does not check whether an analysis is complete. Malformed or in-progress 2xx responses need to be classified as inconclusive.
- `bot/tests/urlscanner.test.ts` only asserts the pure coverage classifier. It does not test provider adapters, missing credentials, timeout/exception behavior, partial failures, cache writes, cache-key versioning, or user-facing messages.
- A formal independent review could not be submitted through this connection because the connected GitHub identity is the PR author. A detailed audit comment was posted to PR #402; independent review remains blocked.
- Existing open PR #346 also needs careful review: current `tma/server.js` invokes `get_total_revenue` through the anon-key client, while PR #346 changes the call to a service-role client and restricts function execution. PR #346 is dirty and includes unrelated documentation changes; validate its actual DB privilege behavior on a disposable database and keep the fix focused.

## Tracking report PR
- Draft PR #403 contains the seven requested tracking artifacts and remains unmerged. The matrix is a point-in-time snapshot and the report branch's live SHA can advance as that matrix is updated; re-fetch the PR head/checks before any merge decision.

## Conclusion
No candidate was independently verified end-to-end in this run. The URL scanner has a concrete source-level failure path, but runtime impact and fix require isolated tests and independent review.
 
## Current follow-up as of 2026-10-29
- Complete paginated API snapshot: 17 actual issues (15 open, 2 closed), 393 PRs (34 open, 359 closed, 61 historically merged), 388 branches. The 2026-10-28 CSV rows remain a historical snapshot; current deltas are appended to the matrix.
- PR #409 (ci/401-reliable-root-checks) current head 924e639fe6dcc3843f10a7a181483bbcbe61230c. GitHub Actions run 40930931903 passed both Node 22 and Node 24 jobs, including npm ci for root, bot and TMA and the configured root test command.
- Vercel preview for that exact head is still queued. An earlier head failed with ERR_PNPM_OUTDATED_LOCKFILE because the TMA pnpm importer still referenced removed supertest; root and TMA pnpm importer records were subsequently synchronized. Do not mark Vercel green until the latest deployment reaches READY.
- Issue #408 records the missing pinned ESLint tooling and configuration. The lint script was excluded from the new workflow rather than faked or silently substituted by typecheck.
- PR #402 remains draft. Alongside existing provider-adapter review blockers, source inspection shows consumeCredit decrements finite credits before checkUrlSafety throws on an inconclusive scan; the handler catch returns an error without a refund. New issue #410 records the required concurrency-safe credit settlement and tests.
- Payment review for #390: tma/server.js catches errors during user lookup/fulfilling a Razorpay payment and still returns HTTP 200. The tracked migrations searched do not define fulfill_payment; retry/idempotency changes remain blocked until the authoritative SQL and duplicate/concurrency behaviour are verified.
- No merge was performed. The Codex review trigger reached the account's review usage limit; the CodeRabbit review of #409 was still in-progress on an earlier head, so no completed independent review is claimed. Current #409 review is pending.

 
## Additional review of recent open UI/performance PRs
- #405: the button-loading patch changes every .btn to “Processing...” for a single selected plan. Sourcery filed a matching medium-priority review comment; issue #411 now tracks scoped loading feedback and terminal-path restoration.
- #404 and #355 overlap on consent_given middleware state and avoiding per-upload queries. #355 also removes the unrelated tracked plan.md file (-78 lines); comments on both PRs request consolidation and restoration/rationale before merge. #406 also changes the same middleware projection to select all columns, which overlaps the consent projection but does not itself replace the handler-side state usage.
- #354, #358, and #407 all modify the same viewCheckDetails() stub in tma/public/js/app.js. #407 is the most complete of the inspected variants (includes check ID and a non-Telegram alert fallback). Comments on all three request one canonical PR rather than merging duplicate edits.
- #406 and #407 have Sourcery approvals recorded, but approval alone does not replace checking branch freshness and all required CI/review gates. #404 has no submitted formal review in the inspected metadata; #405 has a Sourcery COMMENTED review with the button-scope finding.
