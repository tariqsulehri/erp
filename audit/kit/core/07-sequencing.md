# 07. Sequencing (Stage 6)

Turn the verified findings into **the best order to fix them**. Severity says how bad, urgency says how soon, sequence says **in what order**, and the last is not the same as the first two.

## 1. Add the planning fields

For each finding, set:

- `blocked_by`: IDs that must be fixed first (a real technical dependency, not a preference).
- `chain_id`: the attack chain it belongs to, if any.
- `fix_risk`: `low | medium | high`.
- `needs_decision` and `decision_id`: if the fix depends on a choice the user must make.

The build derives `unblocks`, `quick_win`, and the final `sequence` number.

**Quick win** = impact is High or severity is Critical/High, **and** effort is `S`, **and** `fix_risk` is `low`.

## 2. Ordering rules (in priority order)

1. **Contain first (U0).** Stop active exposure before anything else, for example remove leaked data from responses, then tell the user to rotate secrets.
2. **Prerequisites before dependants.** If B needs A, A goes earlier. Typical prerequisites: tests and a CI gate before risky refactors; shared helpers before callers; backend contract before frontend; routes before features that need URLs.
3. **Break attack chains at the cheapest link.** If one fix cuts a chain of three Highs, it goes early.
4. **Group by code area.** Fixes in the same file or module go in the same wave. Fewer merge conflicts, one review.
5. **Quick wins early.** At equal urgency, high impact + low effort goes first.
6. **Risky or irreversible work late, with a safety net.** Data migrations, schema changes, auth rewrites and big refactors come after tests, backups and a rollback plan exist. Add those as explicit steps or findings if missing.
7. **Decisions in parallel.** Ask early for every `needs_decision`, so a missing answer does not stall a later wave. Items that cannot proceed are marked `needs-decision`, not left to block everything else.

## 3. Build the waves

A **wave** is a group of fixes done together, ending in a checkpoint.

- **Wave 0**: every U0 finding and their prerequisites. Small, fast, high value.
- **Wave 1..n**: group by urgency and dependency. Keep each wave to what the team can finish in about one to two sprints, using `TEAM_SIZE` and `RELEASE_CADENCE`.
- Optionally label each wave with a **track** (for example Engineering, UI/UX) so two people can work in parallel.
- Each wave needs: `id`, `name`, `track`, `goal` (one sentence), `ids`, `effort` (sum of estimates, honest about uncertainty), `exit_criteria` (checkable statements, for example "no response contains `password_hash`", "coverage not below baseline"), `checkpoint` (true when the user must approve before the next wave), `why_order` (one or two sentences: why this wave sits here).
- Every finding is in **exactly one** wave, or is `deferred` / `needs-decision` with a reason.
- A finding must never be in an earlier wave than any of its `blocked_by`.

## 4. Decisions

List each decision once, with: `id`, `question`, `options` (and the trade-off of each), `recommended`, `blocks` (finding IDs), and `needed_by` (a wave). Do not choose for the user.

## 5. Safety nets to add when they are missing

If the project lacks these and the plan includes risky fixes, add a finding or wave step for each: automated tests on the affected area, a CI gate, backups and a tested restore, a feature flag or rollback path, a staging environment, a migration dry-run on a disposable database.

## 6. Sanity checks (the build also enforces most of these)

- No dependency cycle in `blocked_by`.
- No finding ordered before its blocker.
- All U0 findings are in Wave 0.
- Wave contents and effort totals are consistent.
- The recommended order is a **recommendation**: state your assumptions (team size, cadence, environment access) and your confidence in the plan.

## 7. The "fix first" list

Write the top 10 into `summary.fix_first`: each with the finding ID and a one-line reason such as "Sequence 3: stops active exposure and unblocks 5 findings."
