# Re-audit (diff mode)

Use after remediation, or on a schedule, to see what changed since an earlier audit.

## Setup

- Set `PREVIOUS_RUN` in the config to the earlier run folder.
- Run the normal workflow (`AUDIT.md`) on the **current** code. Do not copy results from the old run without checking them again.

## Rules

1. **Keep IDs stable.** If an issue from the old run is still there, reuse its ID. A new issue gets a new ID (the next free number for that dimension). Never reuse the ID of a different issue.
2. **Re-verify every old finding on the current code.** For each one, decide:
   - `still open`: evidence is still true.
   - `fixed`: confirm with the proof test or a trace. Record the commit if known and set `status: "fixed"`.
   - `regressed`: it was fixed before and is back. Keep the ID, set `status: "open"`, and say so in `evidence`.
   - `not-reproduced`: it does not exist now and you cannot find that it ever did.
   - `accepted` / `deferred`: only if the owner said so; cite where.
3. **Look for new issues** with the full normal review, not only the old areas. Fixes often move problems.
4. **Check the fixes themselves.** Does each fix have its test? Did it create a new weakness (for example a new endpoint, a broader permission, a new dependency)?
5. **Scores and grade** are recomputed from today's findings, not copied.

## What the build adds

`report.config.json` carries `previous_run`. The build writes `diff-vs-previous.json` with: `new`, `fixed`, `regressed`, `severity_changed`, `unchanged`. The report shows **New** and **Regressed** badges and a "Since last run" line in the summary.

## Add to the summary

- Counts: fixed, new, regressed, still open, by severity.
- Trend in one sentence: is the system getting safer, flat or worse, and why.
- Any fix that was done but has no test: raise it as a finding.
