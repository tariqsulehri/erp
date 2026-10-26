# 08. Report (Stage 7)

You do **not** write HTML. You write `findings.json` and `report.config.json`, then run:

```
node <KIT>/tools/build-report.mjs <run-folder> --strict
```

It validates the data, checks the dependency graph, derives the order, and writes `report.html` (one self-contained file), `findings.csv`, and a normalised `findings.json`. If it fails, fix the data.

## Files you write

- `report.config.json`: see `templates/report.config.example.json`. Title, project, date, repos and commits, mode, scope, auditor, confidentiality, team size, previous run.
- `findings.json`: see `templates/findings.example.json` for a full example. Top-level keys:

| Key | What it holds |
|---|---|
| `summary` | `headline` (one sentence), `overall_grade` (A to F), `top_risks` (up to 5: plain words, with finding IDs), `do_this_week` (short list), `fix_first` (top 10, ID + reason) |
| `scorecard` | One row per dimension audited: `dimension`, `score` (0 to 5), `why` |
| `findings` | The findings (see `05-finding-schema.md`) |
| `chains` | Attack chains: `id`, `title`, `steps`, `ids`, `break_at` (the cheapest fix) |
| `waves` | The plan (see `07-sequencing.md`) |
| `decisions` | Open questions for the user |
| `strengths` | What is done well: `title`, `detail`, optional `locations` |
| `coverage` | `reviewed` (area, depth), `skipped` (area, reason), `gaps` (text) |
| `tools` | `name`, `version`, `purpose`, `result` |
| `baselines` | Numbers from tools: tests, coverage, lint/type errors, vulnerable deps, bundle size. Only real values; leave a key out if unknown |

## Grading

- **Scorecard**: 0 = absent or broken, 1 = serious gaps, 2 = weak, 3 = acceptable, 4 = good, 5 = excellent. Justify in `why`. A dimension with a Critical finding cannot score above 2.
- **Overall grade** (A to F) must follow the findings:
  - **F**: any Critical finding in Wave 0 that is not contained.
  - **D**: any Critical, or three or more High.
  - **C**: one or two High.
  - **B**: no High, several Medium.
  - **A**: only Low, strong tests and operations.
  Say the rule you used in `summary.grade_note`.

## Sections the report shows (empty ones are hidden)

1. Cover and header
2. Executive summary: grade, severity tiles, top risks, do this week
3. Fix first (top 10 in order)
4. Scorecard
5. Risk heat map (needs `likelihood` and `impact` on findings)
6. Quick wins
7. Fix plan: waves with exit criteria and why-this-order
8. Attack chains
9. Decisions needed
10. Findings explorer: filter by severity, urgency, dimension, repo; search; sort by recommended order
11. Strengths to keep
12. Coverage and gaps
13. Tools and baselines
14. Appendix: severity and urgency definitions, methodology

## Write for two readers

- **A manager** reads the summary and the plan: plain words, impact first, no jargon.
- **An engineer** reads the findings: precise evidence, exact locations, the fix, and the test.

## Before you finish

- Scan the output for secrets and personal data. Mask or remove.
- Confirm that every `file:line` was checked (principles §1).
- Confirm the confidentiality label is set.
- Write `run.json`: kit version, model, tools and versions, start and end time, mode, DEPTH, and any limit you hit.
- Stop at **Checkpoint B**.
