# Repository maintenance checklist

Use this checklist for a small maintenance task that does not change product
behavior.

## Inspect

- [ ] Confirm the intended branch and a clean working tree.
- [ ] Check recent commits for overlapping work.
- [ ] Locate the relevant package scripts and project guidance.

## Change

- [ ] Keep the task in one clearly named directory or module.
- [ ] Avoid credentials, environment files, deployment configuration, and
      database migrations unless the task explicitly requires them.
- [ ] Prefer explicit, reversible changes over generated bulk edits.

## Validate

- [ ] Run the narrowest relevant test, lint, or typecheck command.
- [ ] Run `git diff --check`.
- [ ] Inspect the staged diff for unrelated files and secrets.
- [ ] Record any validation that was unavailable and why.

## Hand off

- [ ] Use focused commits with meaningful messages.
- [ ] Push only the intended branch.
- [ ] Report changed files, commands run, and remaining risks.
