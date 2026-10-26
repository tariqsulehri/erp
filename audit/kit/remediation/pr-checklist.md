# Pull request checklist (per wave)

Copy into the PR description.

**Wave:** `<id>` · **Findings:** `<IDs>` · **Audit run:** `<folder>`

## What changed
- One line per finding: ID, what was wrong, what the fix does.

## Proof
- [ ] Each fix has a test that failed before and passes now (list them).
- [ ] Type-check, lint, full tests and build pass.
- [ ] Coverage is not below the baseline: before `<n>%` after `<n>%`.
- [ ] UI changes: checked in light and dark, narrow and wide, keyboard only (screenshots attached).

## Safety
- [ ] No secrets, personal data or production hostnames in code, tests, fixtures or commits.
- [ ] No test, lint rule or quality gate was weakened or skipped.
- [ ] Migrations ran on a disposable database, twice, with a rollback check.
- [ ] Contract changes are backward compatible for one release, or flagged below.

## Contract changes
- Describe any API, schema or config change and who consumes it.

## Owner actions (done by hand, not by the agent)
- [ ] e.g. rotate secrets, run the production scrub script, change branch protection.

## Rollback
- How to undo this change, and what data it touches.

## Review focus
- Where reviewers should look hardest.
