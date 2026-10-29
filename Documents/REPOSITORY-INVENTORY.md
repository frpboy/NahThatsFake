# Repository Inventory

Repository: frpboy/NahThatsFake
Default branch: main
Baseline SHA: 682aa8cfb72a15ee69dc796eba00e911d760b418
Snapshot: 2026-10-28
Visibility: public

## Paginated inventory totals
- Issues (excluding PR records): 15 total; 13 open; 2 closed.
- Pull requests: 388 total; 29 open; 359 closed; 61 historically merged.
- Branches: 383; none reported protected=true in the branch-list API response.

## Stack and repository conventions
- Telegram bot: Node.js/TypeScript under bot/.
- Telegram Mini App: JavaScript/Express under tma/.
- Database and migrations: supabase/.
- Existing documentation is in Documents/; no top-level docs/ directory was present.
- Root package.json has a placeholder test script that exits nonzero.
- At the 2026-10-28 baseline, .github/ contained dependabot.yml but no workflows. Draft PR #409 now adds a CI workflow on its feature branch; it has not been merged to main.

## Access and execution limits
- GitHub metadata reports admin/maintain/push permissions.
- Rulesets endpoint returned an empty list; branch metadata reports protected=false.
- Direct branch-protection detail endpoint returned HTTP 403, so effective settings are incompletely verified; see issue #400.
- No local checkout or .git directory was available in the execution container; tests/build/lint/scanners were not run.
- Baseline Vercel status is failure due to deployment rate limiting for 24 hours; this is not a code-test result.

## Snapshot timing

The inventory was captured before creating the reporting branch and draft PR #403; it intentionally does not include its own branch/PR in the 382-branch/387-PR baseline snapshot.

## Current delta checked 2026-10-29
- Current paginated GitHub API snapshot: 17 actual issues (15 open, 2 closed), 393 pull requests (34 open, 359 closed; 61 historically merged), and 388 branches.
- Changes since the 2026-10-28 report snapshot include open PRs #404, #405, #406, #407, and #409 plus five corresponding feature branches, and issues #408 (missing reproducible ESLint setup) and #410 (credit loss on inconclusive URL scans). The PR/branch matrix keeps the original snapshot and appends those verified deltas.
- PR #409 head: 924e639fe6dcc3843f10a7a181483bbcbe61230c; GitHub Actions passed on Node.js 22 and 24 (run 40930931903). The current Vercel preview for this head remains queued; an earlier head failed with ERR_PNPM_OUTDATED_LOCKFILE before the pnpm lockfile importer fix.
- Issue #401 remains open pending review and a confirmed post-fix Vercel deployment. Issue #408 remains open because ESLint tooling/configuration is not checked in.
- Issue #390 source review confirmed the Razorpay webhook acknowledges with HTTP 200 after a fulfilment-path error, while the authoritative fulfill_payment SQL definition is absent from tracked migrations. Duplicate credit/entitlement behaviour is not proven; do not change retry/idempotency semantics without versioned SQL and isolated tests.

## Completeness note
Inventory reads were paginated. This is not a claim that every historical PR diff, review thread, check run, or every branch commit has been content-reviewed. See PR-AND-BRANCH-MATRIX.csv.