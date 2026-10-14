# Small-change Git workflow

Use one branch for one coherent outcome. Keep changes reviewable by separating
documentation, tooling, and application behavior.

## Before editing

1. Start from an updated base branch and inspect `git status --short --branch`.
2. Read the nearest README and package scripts before choosing a validation
   command.
3. Do not mix local configuration, credentials, migrations, or generated files
   with an unrelated change.

## Before committing

1. Run the narrowest relevant test or static check.
2. Run `git diff --check` to catch whitespace errors.
3. Review `git diff --cached` and stage explicit paths rather than broad globs.
4. Use an imperative commit title that says what changed.

## Before pushing

1. Confirm the branch is the intended remote target.
2. Confirm no secret, environment, or generated artifact is staged.
3. Push once after the commits are ready; do not use force-push for ordinary
   contribution work.
