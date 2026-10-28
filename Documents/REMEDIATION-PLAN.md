# Remediation Plan

Baseline: 682aa8cfb72a15ee69dc796eba00e911d760b418

## P0 — security correctness
1. #399 / PR #402: add isolated provider-mocked tests for both clean, one failure/one clean, partial detection, both failures, missing configuration, timeout, exceptions, 404 versus 429/5xx, malformed 2xx and in-progress analyses. Confirm inconclusive never maps to LOW or cache; retain detections and sanitize logs. Verify cache/no-cache and user-facing messages, require independent review and passing checks.
2. #390: locate/version exact SQL, enforce provider/payment uniqueness and atomic fulfillment, test duplicate/concurrent callbacks using dummy fixtures in disposable DB; verify amount/currency/ownership/state.
3. #391: trace URL parsing and all outbound requests; isolated tests for schemes, credentials, loopback/private/link-local/metadata IPs, redirects, DNS rebinding, timeouts and response-size caps.
4. #395: independent reviewer reproduces findings and retests exact commits; otherwise remain blocked.
5. #396–#398: reconcile component coverage, findings, tests, PRs and residual gaps before final report.

## P1 — governance and CI
6. #400: verify effective branch protection/rulesets through an authorized route; require PRs, approval and checks, prohibit force-push/deletion as appropriate, then test safely.
7. #401: add PR/push CI for bot typecheck/build/tests and meaningful TMA checks. Replace placeholder root test only after package-manager/workspace strategy is agreed.
8. #373: choose canonical package manager per workspace and reconcile npm/pnpm lockfiles; verify reproducible installs and dependency audits.

## PR #402 static-review blockers
- Narrow the VirusTotal existing-report fallback to a confirmed not-found response; provider errors/timeouts/rate limits must remain unavailable, not trigger a new submission.
- Validate provider response schemas and analysis completion before treating a result as clean.
- Formal independent review is not available through the current connection because it is the PR author; obtain another reviewer.

## Branch/PR backlog
Review all 29 open PRs and 383 branches by exact head/base SHA, unique commits, actual diff, review threads, checks, conflicts, duplication and linked issues. Names/file overlap alone do not establish safe disposition.

## Merge gate
No PR is eligible until current diff is reviewed, required checks pass, independent approval is present where applicable, dependencies/conflicts are resolved, and post-merge checks are defined. No merges were performed in this run.