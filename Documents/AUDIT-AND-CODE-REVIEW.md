# Audit and Code Review

Repository: frpboy/NahThatsFake
Baseline SHA: 682aa8cfb72a15ee69dc796eba00e911d760b418
Status: PARTIAL — no security sign-off.

## Source-level candidate: issue #399
At baseline, bot/src/services/urlscanner.ts returned empty threat arrays or zero counts when provider credentials were missing or provider requests failed. Promise.allSettled then allowed a zero score to map to LOW. bot/src/handlers/link.ts could cache that result for seven days. This is source-level evidence of a failure path; independent runtime reproduction was not performed.

Draft remediation: PR #402, branch fix/url-scan-provider-failure-state, head 62a6251dd3459f54a9c0b07323170911bb1cbbf5. It changes missing/failed providers to explicit failures, classifies coverage, prevents inconclusive scans from being presented as LOW, avoids caching partial results, versions the cache key and avoids logging credential-bearing request details. A classifier assertion test was added. Provider adapter behavior remains unvalidated.

## Other open candidates
- #390: payment fulfilment idempotency; SQL/schema and concurrent delivery tests required.
- #391: SSRF/redirect/DNS boundaries; actual server-side URL-fetch path remains unverified.
- #388/#389: feedback RLS change merged, effective deployed grants not verified.
- #386/#387: Telegram validation/abuse controls merged, runtime tests not verified.
- #400: governance; branch protection detail endpoint returned 403.
- #401: CI reliability; no workflow directory and root test script is a placeholder.

## Coverage ledger
| Area | Status | Limitation |
|---|---|---|
| Repository identity and baseline | Reviewed | GitHub metadata and recursive tree |
| Issues/PRs/branches | Inventory retrieved | 15 issues, 387 PRs, 382 branches; not every diff/review/check reviewed |
| URL scanner failure handling | Source reviewed; draft fix | No local test run or provider integration tests |
| Payment idempotency | Needs validation | #390; disposable DB/concurrency tests unavailable |
| URL SSRF | Needs validation | #391; isolated harness not run |
| RLS and effective grants | Partial | No disposable DB/live policy verification |
| Dependencies/SBOM/history secrets | Not completed | Scans not executed |
| CI/CD | Partial | No workflow directory; Vercel rate limit |
| Accessibility/performance | Not completed | No systematic tests/performance run |
| Independent verification | Blocked | No separate reviewer available in this run |

## Checks actually run
- Paginated GitHub API inventory and metadata reads.
- Compare of PR #402 against baseline: 4 commits ahead, 0 behind; 4 changed files.
- Tests/build/lint/dependency scans/secret scan: not run; no local checkout available.
- PR #402 observed Vercel status: failure due to deployment rate limit, not a test result.

## Conclusion
No candidate was independently verified end-to-end in this run. The URL scanner has a concrete source-level failure path, but runtime impact and fix require isolated tests and independent review.