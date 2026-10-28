# Repository Inventory

Repository: frpboy/NahThatsFake
Default branch: main
Baseline SHA: 682aa8cfb72a15ee69dc796eba00e911d760b418
Snapshot: 2026-10-28
Visibility: public

## Paginated inventory totals
- Issues (excluding PR records): 15 total; 13 open; 2 closed.
- Pull requests: 387 total; 28 open; 359 closed; 61 historically merged.
- Branches: 383; none reported protected=true in the branch-list API response.

## Stack and repository conventions
- Telegram bot: Node.js/TypeScript under bot/.
- Telegram Mini App: JavaScript/Express under tma/.
- Database and migrations: supabase/.
- Existing documentation is in Documents/; no top-level docs/ directory was present.
- Root package.json has a placeholder test script that exits nonzero.
- .github/ contains dependabot.yml; no .github/workflows/ directory was present.

## Access and execution limits
- GitHub metadata reports admin/maintain/push permissions.
- Rulesets endpoint returned an empty list; branch metadata reports protected=false.
- Direct branch-protection detail endpoint returned HTTP 403, so effective settings are incompletely verified; see issue #400.
- No local checkout or .git directory was available in the execution container; tests/build/lint/scanners were not run.
- Baseline Vercel status is failure due to deployment rate limiting for 24 hours; this is not a code-test result.

## Snapshot timing

The inventory was captured before creating the reporting branch and draft PR #403; it intentionally does not include its own branch/PR in the 382-branch/387-PR baseline snapshot.

## Completeness note
Inventory reads were paginated. This is not a claim that every historical PR diff, review thread, check run, or every branch commit has been content-reviewed. See PR-AND-BRANCH-MATRIX.csv.