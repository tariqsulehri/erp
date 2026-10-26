# REMEDIATE.md: fix the findings of an audit, wave by wave

> Use only after an audit run exists. Input: the run folder (`findings.json`, `report.html`).
> Paste: *"Follow `<KIT>/remediation/REMEDIATE.md` for run `<run-folder>`."*
> To resume: *"Resume from the REMEDIATION_LOG.md files."*

## 0. Your role

You are the engineers the audit calls for (backend, security, frontend, DevOps, as the findings need). You **fix an existing codebase**, you do not rewrite it. You work one wave at a time, with a test for every change, and you stop at every checkpoint.

## 1. Inputs and ground truth

- `findings.json` is the source of truth for **what** to fix and in **what order** (`waves`, `sequence`, `blocked_by`).
- This file is the source of truth for **process**.
- Where the two disagree: this file wins on process, the findings win on technical detail.
- Read `findings.json` fully before you change anything.

## 2. Rules

### 2.1 Git and branches
1. Never commit to, push to, or merge into the protected branches (`main`, `master`, `staging`, `production`, or those named in config). Never force-push. Never rewrite history.
2. One branch per wave, off the latest base branch: `fix/<wave-id>-<short-name>`. Keep it updated from the base.
3. Small commits. Conventional Commit messages that cite finding IDs: `fix(security): scope order reads to owner (SEC-001)`.
4. **Pushing and opening pull requests need the user's approval** at each checkpoint. Until then, everything stays local.
5. Do not weaken, skip or delete existing tests, lint rules or quality gates to make something pass.

### 2.2 Verify before you fix
1. Re-check every finding on the **current** code. The audit recorded commit hashes; code may have moved.
2. Open the cited `file:line`. Confirm the problem still exists. Then fix it.
3. Already fixed or not reproducible: set `not-reproduced` with the reason and move on.
4. If a fix needs a decision the audit does not settle (`needs_decision`), stop and ask. Do not guess.

### 2.3 Tests and quality bar
A wave is done only when all of these hold, in every repo it touched:
- type-check, lint and the full test suite pass (use the commands from the System Map).
- Build passes.
- **Coverage does not drop below the baseline.**
- **Each security or correctness fix has a test that fails before the fix and passes after it.**
- Each UI fix is checked in a running browser: light and dark, narrow and wide widths, keyboard only. Keep a screenshot for the summary.

### 2.4 Never do these yourself
You may write the code, migrations and scripts. **Running them against any real environment is the owner's job:**
- Rotating passwords, tokens, keys or secrets.
- Purging or scrubbing production logs or data.
- Running migrations, seeds or backfills on anything but a local or disposable database.
- Changing repository settings: default branch, branch protection, pipeline variables.
- Creating registries, cloud resources or third-party accounts.
- Changing vendor contracts, data-processing terms or usage terms.

Never put real credentials, personal data or production hostnames in code, tests, fixtures or commits. Never paste or log secrets. If you find one, stop and tell the owner where.

### 2.5 Cross-repo contracts
When a fix changes an API contract: change the **provider first** and keep it backward compatible for one release where possible, then update the consumer in the same wave, and write the change in both logs.

### 2.6 Tracking
Create `REMEDIATION_LOG.md` at the root of each repo, from `templates/REMEDIATION_LOG.md`. One row per finding, seeded from `findings.json`, all `todo`. Update it as you go. It is how a later session knows where things stand.

## 3. Loop for every wave

1. **Plan.** Update the base branch, create the wave branch, list the wave's finding IDs, re-verify each (§2.2), then write a short plan: order, contract changes, risky steps. Follow the order in `findings.json` (`sequence`). A finding never starts before its `blocked_by` are done.
2. **Fix.** Per finding: write the failing test, make the fix, run the checks, commit.
3. **Verify.** Run the full checks. For UI work, run the app and check it in a browser. For migrations: run them on a **local disposable database** with realistic fake data, run them twice to prove they are idempotent, and test rollback where possible. Prove nothing was lost with counts and checksums before and after.
4. **Report and stop at 🛑.** Post the wave summary: fixed / not-reproduced / deferred / needs-decision; test and coverage numbers before and after; contract changes; screenshots (UI); and **everything the owner must do by hand** (§2.4). Then wait for approval before pushing or starting the next wave.

## 4. Risky waves

When a wave contains a data migration, a schema change, an auth change or a wide refactor (`fix_risk: high`):
- 🛑 **Before writing it**, show the plan: what changes, how existing data is mapped, what happens to rows that do not fit, the rollback strategy, and how you will prove nothing was lost.
- Confirm the safety nets exist (tests on the area, CI gate, backup and restore, rollback path). If not, build them first.

## 5. Decisions

Read `decisions` in `findings.json`. Ask for every decision the current wave needs. Do the parts that do not depend on it, and mark the rest `needs-decision`.

## 6. Definition of done

- Every finding is `fixed`, `not-reproduced` (with a reason), or `deferred` with the owner's written approval.
- No Critical or High finding remains open.
- Dependency audit shows no high or critical issues; secrets scan is clean.
- Coverage is at or above baseline, and critical flows have tests that would catch a regression of each fix.
- Documentation is updated (README, runbooks, ADRs for the decisions taken).
- `REMEDIATION_LOG.md` is complete. Then suggest a **re-audit** (`reaudit/diff-mode.md`) to confirm.

## 7. Start now

1. Read `findings.json` and `report.html`.
2. Record the baseline (type-check, lint, tests with coverage, build) in the log.
3. Post a one-screen summary: baseline, any finding you already suspect is fixed, your plan for Wave 0.
4. Begin Wave 0.
