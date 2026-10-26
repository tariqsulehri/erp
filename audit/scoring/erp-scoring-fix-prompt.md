# Prompt: Align ERP's technical scoring with the business rules (Phase S1)

> **How to use:** open your coding agent in `~/Documents/Work/tkxelbitbucket` and paste everything below the line.
> It can run on its own, or as phase **S1** of `erp-master-prompt.md`. All of that file's rules apply: branches, the 🛑 checkpoints, never pushing without approval, and never touching production data.

---

## 0. Role and goal

You are a senior full-stack engineer on **ERP**:
- **Backend:** `./erp-be`, Express, Prisma, PostgreSQL.
- **Frontend:** `./erp-fe`, React, Vite.

Make the technical-skill scoring match the business owner's rules **exactly**. Today the base formula is correct, but the level multipliers and the level list are wrong. Work on `master` (Release 1.1.1 or later). Create branch `fix/s1-scoring-rules` in **both** repos.

---

## 1. The business rules (source of truth)

### 1.1 Tool score

The original Excel formula:

```
base = IF(type="Primary",   (0.25 * projects/3) + 0.25,
       IF(type="Secondary", (0.15 * projects/3) + 0.15,
       IF(type="Tertiary",  (0.10 * projects/3) + 0.10, 0)))
tool score = base × level multiplier
```

| Input | Values |
|---|---|
| **Type** | Primary 0.25 · Secondary 0.15 · Tertiary 0.10. Any other value scores **0**. |
| **Projects** | Integer 0–3. The UI shows 3 as "3+", and project credit = projects ÷ 3. Keep the existing cap of 3. |
| **Levels** | Exactly three:<ul><li>**Expert** 1.0</li><li>**Intermediate** 0.5</li><li>**None** 0.1</li></ul> |

**The None level:**
- It is the lowest level and the **default** for any tool that hasn't been rated.
- It exists in the data, but it is **never shown as a label**. In dropdowns it is the blank option. In tables, badges, reports and exports it renders as empty.

**Removed levels:** Advanced, Proficient, Beginner, Awareness, Foundational and Unset. No new assessment may use them.

### 1.2 Unchanged

- **Skill score** = the sum of the skill's tool scores, capped at 1.00.
- **Slots:** at most one Primary, one Secondary and one Tertiary tool per skill.
- **Approved only:** only approved assessments count.
- **Everything above the skill score** stays the same: skill-group average, overall %, targets and readiness. The audit covers recalibrating those separately.

### 1.3 Reference values (use in tests)

| Type | Projects | Expert ×1.0 | Intermediate ×0.5 | None ×0.1 |
|---|---|---|---|---|
| Primary | 0 | 0.2500 | 0.1250 | 0.0250 |
| Primary | 1 | 0.3333 | 0.1667 | 0.0333 |
| Primary | 2 | 0.4167 | 0.2083 | 0.0417 |
| Primary | 3 | 0.5000 | 0.2500 | 0.0500 |
| Secondary | 0 | 0.1500 | 0.0750 | 0.0150 |
| Secondary | 1 | 0.2000 | 0.1000 | 0.0200 |
| Secondary | 2 | 0.2500 | 0.1250 | 0.0250 |
| Secondary | 3 | 0.3000 | 0.1500 | 0.0300 |
| Tertiary | 0 | 0.1000 | 0.0500 | 0.0100 |
| Tertiary | 1 | 0.1333 | 0.0667 | 0.0133 |
| Tertiary | 2 | 0.1667 | 0.0833 | 0.0167 |
| Tertiary | 3 | 0.2000 | 0.1000 | 0.0200 |

The values are rounded here to 4 decimals for display. Compare with a tolerance of 1e-4.

---

## 2. What is wrong today (verified on master)

| # | Problem | Where |
|---|---|---|
| 1 | Intermediate weighs **0.4** (should be 0.5) | `erp-be/src/scoring/scoring.engine.ts` (`LEVEL_WEIGHT`), `erp-be/src/modules/config/config.shared.ts` (`DEFAULT_ASSESSMENT_LEVEL_CONFIGS`), `erp-fe/src/lib/scoringPreview.ts` (`LEVEL_WEIGHT`) and the DB table `assessment_level_configs` |
| 2 | "No level" is `Unset` × **0.0** (should be None × 0.1) | same files, plus the default `'Unset'` in `assessment.schema.ts:8` and `assessment.service.ts:248` |
| 3 | Five extra levels exist: Advanced 0.8, Proficient 0.6, Beginner 0.4, Awareness 0.2, Foundational 0.4 | zod enums in `assessment.schema.ts:8,17`; level unions in `erp-fe/src/hooks/useAssessment.ts:13,38`, `components/BulkAssessmentTable.tsx:39,85-94`, `lib/scoringPreview.ts:4`; the DB config rows |
| 4 | An unknown type gets the Tertiary value (the engine's final `else`) | `scoring.engine.ts` `computeAssessmentScore` |
| 5 | Each tool score is rounded to 2 decimals and stored that way (`Decimal(6,2)`), which can tip a borderline target | `schema.prisma` `SkillAssessment.score`, `roundScore` in `computeAssessmentScore` |
| 6 | Stored scores never recalculate when weights change | `skill_assessments.score` and `competency_scores` are written once; `src/scripts/backfill_assessment_scores.ts` exists |
| 7 | Level labels can't be empty (`z.string().min(1)`) | `config.schema.ts:207` |

The DB table `assessment_level_configs` **overrides** the code defaults (`scoring-config.service.ts`). The frontend reads the same table for its dropdown. You must fix **both** the data and the code.

---

## 3. Tasks

### 3.1 Backend (`erp-be`)

1. **Engine** (`src/scoring/scoring.engine.ts`):
   - `LEVEL_WEIGHT = { Expert: 1.0, Intermediate: 0.5, None: 0.1 }`.
   - The type lookup returns **0** for anything that isn't exactly Primary, Secondary or Tertiary.
   - Return the tool score **unrounded**. Rounding happens only for display.
   - An unknown level code scores 0 and logs a warning. It must never silently fall back.
   - Update the JSDoc formula block.
2. **Defaults** (`src/modules/config/config.shared.ts`):
   - `DEFAULT_ASSESSMENT_LEVEL_CONFIGS` must hold exactly these three rows, with matching descriptions:

     | code | label | weight | sort_order | is_active |
     |---|---|---|---|---|
     | Expert | "Expert" | 1.0 | 1 | true |
     | Intermediate | "Intermediate" | 0.5 | 2 | true |
     | None | "" | 0.1 | 3 | true |

   - Keep the type defaults (0.25, 0.15, 0.10) and project defaults (0–3, credit p/3).
3. **Validation:**
   - `assessment.schema.ts`: `level: z.enum(['Expert','Intermediate','None'])`. The create schema defaults to `'None'`; the update schema is optional.
   - The service fallback in `assessment.service.ts:248` becomes `'None'`.
   - `config.schema.ts`: allow an empty `label` **only** for code `None` (refine). Every other level label stays `min(1)`.
4. **Prisma migration** `<timestamp>_s1_scoring_levels`:
   - Change `skill_assessments.score` to `Decimal(8,4)`. If `competency_scores.score` is `Decimal(_,2)`, change it to `Decimal(8,4)` too.
   - Change the `SkillAssessment.level` default to `'None'`.
   - Upsert the three `assessment_level_configs` rows above.
   - Set `is_active = false` on Advanced, Proficient, Beginner, Awareness, Foundational and Unset. Don't delete them yet, so the migration can be rolled back.
   - **Do not** change level values on existing assessment rows in this migration (see 3.4).
5. **Readers:** any backend code that switches on old level codes must handle only Expert, Intermediate and None:
   - report helpers
   - skill-matrix letters (E / I, blank for None)
   - CSV / XLSX exports
   - `scoreToLevelLabel` is about *skill* scores, so leave it alone.

   Grep for `'Advanced'`, `'Proficient'`, `'Beginner'`, `'Awareness'`, `'Foundational'` and `'Unset'` across `src/` and fix every hit.
6. **Tests:**
   - A table-driven test of all 36 combinations in §1.3, on `computeAssessmentScore`.
   - `computeCompetencyScore` still caps at 1.00.
   - An unknown type scores 0.
   - The API rejects the removed levels with 400.
   - Creating an assessment without a level stores `None`.
   - The config schema accepts an empty label for None only.

### 3.2 Frontend (`erp-fe`)

1. **Preview and types:**
   - `src/lib/scoringPreview.ts`: same weights, the same unrounded math as the backend, and `AssessmentLevel = 'Expert' | 'Intermediate' | 'None'`.
   - Update the unions in `hooks/useAssessment.ts` and `components/BulkAssessmentTable.tsx`.
2. **Dropdowns** (`BulkAssessmentTable`, `BulkAssessmentTableRow`, `AssessmentForm`, `PendingApprovalsPanel`):
   - Options come from active level configs, sorted by `sort_order`.
   - **None renders as a blank option** (empty text, with `aria-label="No level"` for screen readers) and is selected by default.
   - The fallback list when configs are empty is the same three.
   - Replace `LEVEL_LABELS` with `{ Expert:'Expert', Intermediate:'Intermediate', None:'' }`.
3. **Display everywhere:**
   - A level of None shows **nothing**: no badge, no "None", no "Unset", no "—". That covers tables, approvals, the result sheet, PDF and print, CSV export, the skill matrix and tooltips.
   - Score numbers show 2 decimals for display only.
4. **Setup → Assessment levels screen:**
   - Show all three rows.
   - The None row shows an empty label field with the helper text "Hidden level: used when no level is chosen".
   - Admins can still change its weight.
   - Admins cannot deactivate None or delete any of the three.
5. **Tests:**
   - The same 36-case table against `computeAssessmentScorePreview`.
   - Dropdowns render exactly two visible options plus a blank default.
   - No rendered component shows the text "None" or "Unset" for a level.

### 3.3 Recalculate stored scores

1. **Script:** extend `src/scripts/backfill_assessment_scores.ts`, or add `recompute_scores_s1.ts`. It must:
   - recompute `skill_assessments.score` from (type, projects, level) with the new weights
   - then recompute `competency_scores` for every affected employee
   - run inside transactions, in batches
   - be idempotent
   - support `--dry-run`, which writes a CSV report (`employee_code, skill, old_score, new_score, old_meets_target, new_meets_target`)
2. **🛑 Checkpoint.** Run it with `--dry-run` against a **local** database seeded with realistic fake data. Show me:
   - how many skill scores went up or down
   - how many people's technical readiness changes
   - the largest movements

   Then wait. I decide whether to apply it to all periods or only the open one, and I run it on production myself.

### 3.4 Map existing ratings to the new levels

🛑 **Checkpoint before writing this.** Proposed default mapping, applied by a separate, reversible data script `migrate_levels_s1.ts`:

| Old level | New level |
|---|---|
| Expert | Expert |
| Advanced | Expert |
| Proficient | Intermediate |
| Intermediate | Intermediate |
| Foundational | Intermediate |
| Beginner | Intermediate |
| Awareness | None |
| Unset | None |

The script must:
- record the old level in an `assessment_level_migration_log` table (assessment_id, old_level, new_level, migrated_at), so the change can be reversed
- run only after I confirm the mapping
- run the score recompute from 3.3 afterwards

Show me row counts per old level (local fake data, and the production SQL I can run myself) before applying.

### 3.5 Documentation

- Update the scoring section of `STANDARDS.md`, or create `docs/scoring.md`, with the formula, the three levels, the hidden None level, and the §1.3 table.
- Update the JSDoc in both preview and engine.
- Add a row per change to both `REMEDIATION_LOG.md` files.

---

## 4. Acceptance criteria

- [ ] All 36 reference cases pass in **both** the backend engine and the frontend preview, within 1e-4.
- [ ] The only levels accepted by the API, stored by default, offered in the UI and configurable in Setup are Expert, Intermediate and None.
- [ ] None is never shown as text anywhere in the UI or exports, and it is the default selection.
- [ ] An unknown type scores 0. An unknown level scores 0 and logs a warning.
- [ ] Tool scores are stored with 4 decimals and shown with 2.
- [ ] The migration runs, re-runs and rolls back cleanly on a local database. The old level config rows are inactive, not deleted.
- [ ] The dry-run recompute report is produced, and nothing has been applied to any real database.
- [ ] `npm run type-check`, `npm run lint`, `npm test` and `npm run build` (FE) all pass. Coverage doesn't drop.
- [ ] I get a summary with:
  - before and after screenshots of the assessment table, approvals and the Setup levels screen
  - the dry-run numbers
  - the exact production commands for me to run: migration, level mapping, recompute

## 5. Out of scope (don't change)

- Skill targets per grade, skill-group weights, readiness rules, CEFR and behavioral scoring.
- Period handling (BE-ARC-04).
- The audit tracks these separately. Note in your summary that the new weights raise Intermediate scores (0.4 → 0.5) and give unrated tools a small score (0 → 0.1). The targets may need recalibrating afterwards.
