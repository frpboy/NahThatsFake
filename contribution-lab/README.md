# Contribution Lab

This directory is an isolated place to practice repository-safe contribution
habits without changing the Telegram bot, Mini App, deployment setup, or
database.

## Contents

- `git-workflow.md` — a small, reviewable workflow for changes.
- `change-scope.js` — a dependency-free helper for grouping changed files.
- `change-scope.test.js` — executable examples for that helper.
- `maintenance-checklist.md` — a pre-push checklist for everyday work.

Run the lab examples with:

```bash
node --test contribution-lab/change-scope.test.js
```

The lab is deliberately not imported by application code. Its purpose is to
make small changes easier to review, test, and revert independently.
