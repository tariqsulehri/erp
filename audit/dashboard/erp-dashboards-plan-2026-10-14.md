# ERP Dashboards: Role Plan for the Current App

| | |
|---|---|
| **Date** | 2026-10-14 |
| **Source** | `erp-dashboards-blueprint.html`, `erp-dashboards-roadmap.md`, `erp-master-prompt.md` (all dated 2026-10-08) |
| **Checked against** | `origin/master`: frontend v1.2.1, backend v1.3.0 (revised 2026-10-15, see §0) |
| **Roles** | Engineer, Line Manager, Manager, Top Management, Admin |
| **Status** | Plan only. No code written. |

---

## 0. Revision 2026-10-15: the app moved after this plan was first written

The first version of this plan was checked against old local branches. The released code is `origin/master`:
**frontend v1.2.1, backend v1.3.0** (tkxel themes, heatmap redesign, `?scope=self`). The local `frontend/` and `backend/` folders are on old branches (frontend `fix/sonar-alert-info-border` at v1.1.20, backend `fix/sec-021-reports-guard` at v1.1.1) and local `master` in frontend is v1.1.6. **Branch every dashboard phase from `origin/master`, never from what is checked out.**

The blueprint HTML itself is unchanged (same size and text).

| Finding | Effect on the plan |
|---|---|
| **Five themes, default `tkxel`** (Light, Dark, Midnight kept but hidden; `tkxel`, `tkxel-dark` live). Tokens: `styles/themes/brand-palette.css` (only place for raw colours), `tkxel-light.css`, `tkxel-dark.css`, `tkxel-components.css`. | Blueprint colours and gradients are **dropped**. Every new token (`--hero-bg`, `--tile-*`) is defined in the theme files and refers to brand-palette names. The three hidden themes must keep working (owner rule), so each new token also gets a value there. |
| Brand: blue `#0755E9`, orange `#EE4200` is for marks and large text only (3.88:1 on white). | The blueprint's orange "Behavioral" tile is not allowed. Tiles are blue-family or neutral. Status colours stay reserved. |
| `--grade-l1..l5` already exist (one blue hue, light to dark) for CEFR and behavioural levels. | Reuse for the ordinal ramp. Grade pills need up to the number of grades per department, so check the count before adding steps. |
| Charts still follow the base theme (`BASE_OF` in `themeStore.ts`: tkxel → light, tkxel-dark → dark) through `useChartTheme()`. Recharts needs hex values. | New chart code reads colours from `useChartTheme`, not CSS variables in SVG attributes. |
| **JetBrains Mono and Poppins are installed** (`@fontsource`). | Blueprint's mono tabular numerals: no new dependency. |
| **Matrix-table standard exists** (`ui/matrix/`: `MatrixColumnHead`, `MatrixGroupRow`, `MatrixCorner`) and the **Skill Heatmap** was redesigned on it. | Blueprint "StatusGrid" and the D4 skills-matrix work shrink to: add letter cells and hollow-pending on top of the existing standard. Do not build a second grid. |
| Existing pieces that already match blueprint widgets: `StackedBar` + `StackedBarLabels` (SegmentedBar), `BulletChartRow` (BulletBar), `OrdinalMeter`, `DashboardKpiCard` (KpiTile base), `PillarReadinessRings`, `PillarAttainmentChart`, `GroupRankingList`, `TopPerformersList`, `DepartmentExcellenceList`, `YoYGrowthTab`, Health Overview cards. | The "new components" list in §3a M10 is cut to what is really missing: **ChartCard, SectionHeader, HeroBanner, ScopeSwitcher, CapsuleColumns, BarList, StripPlot, UnitMatrix, TrendLine, OrgChart, CalendarMonth, Avatar** (KpiTile = extend `DashboardKpiCard`). |
| **`MyReport` + `?scope=self` + `PersonVsTeamPanel mine`** shipped (backend 1.3.0, every report endpoint). | The Engineer "My Growth" dashboard is mostly built. Its hook is `useMyGapMatrix`. The Engineer phase becomes "assemble and upgrade", not a new build. |
| `axe-core` is installed, `@axe-core/playwright` and Lighthouse CI are not. Playwright and a visual harness (`test:e2e:visual`) exist. | D-I needs one extra dev dependency, not two tools. |
| Backend schema on master: W4a live (`skill_assessments.appraisal_period_id` is now required). Still **no** `joined_at`, `designation`, `approved_at/by`, grade history, or "returned" status. | Data gaps M1–M5 unchanged. |
| Reports sidebar today: Leaderboard, Health Overview, Promotion Readiness, CEFR Benchmarks, YoY Growth, Domain Scores, Skill Matrix, Skill Deficit, Star Ratings, Member Scorecard. | The dashboards must link to these, not duplicate them. A dashboard tile that repeats a report becomes a summary that opens that report. |
| Brand theme ships `?` help, `Empty` with brand mark, `BrandLockup` in header. | New screens use `Empty` and `HelpButton` as they are. |

---

## 1. Path and name corrections

The blueprint was written for a different layout (`erp-be` / `erp-fe`, a `/app/...` router, Jest on both sides). Use the right-hand column from now on.

| Blueprint says | Real app | Note |
|---|---|---|
| `erp-be/`, `erp-fe/` | `backend/`, `frontend/` | Separate git repos. Always `cd` first. |
| `erp-audit-2026-10-06.md` §10 "ERP Prism" | `audit/` folder has the HTML report only. Tokens live in `frontend/src/styles/globals.css` (`rgb(var(--token))`, 3 themes). | **Prism tokens do not exist in code.** See §4. |
| `src/styles/tokens.css` | `frontend/src/styles/globals.css` + `styles/themes/` (brand-palette, tkxel-light, tkxel-dark) | Since the tkxel release. |
| `src/components/ui/dashboard/`, `ui/charts/` | Same folders exist already: `frontend/src/components/ui/dashboard/` (2 files), `ui/charts/` (3 files) | Extend them. |
| `/dev/components` gallery with a story per component | Does not exist | Use unit tests + `COMPONENT_CATALOG.md` entry instead. |
| Route `/app/workforce`, `/app/schedule` | One SPA: only `/login` and `/dashboard`. A screen = a new `TabType` in `components/dashboard/types.ts` + `NAV` entry + branch in `pages/DashboardPage.tsx` | No URL routing for screens (only `?report=`). |
| Replace today's "Overview" | `OverviewTab.tsx` (leaders) and `ResourceOverviewDashboard.tsx` (engineers) | Rebuild these two; do not add a parallel home. |
| `src/modules/analytics` | `backend/src/modules/analytics/` (new). Pattern: router → controller → service → schema → test. Mount in `backend/src/app.ts` under `/api/v1/analytics`. | Does not exist yet. |
| `accessScopeService` | `backend/src/modules/access/access-scope.service.ts` | Exists. Has `getAccessibleEmployeeIds`. |
| "RBAC matrix test" | `backend/src/app.route-guards.test.ts` (every route must have an authorize guard) | New analytics routes must pass it. |
| Jest on both repos | Backend: Jest. Frontend: **Vitest** + Playwright (`frontend/e2e/`) | |
| Dashboard tabs list `Admin Dashboard, Overview, Pending Approvals, Team Roster, Reports ...` | `NAV` in `components/dashboard/types.ts` | This is the real menu. |
| Roles incl. `COMMUNICATION_EXPERT`, `LANGUAGE_EXPERT` | Removed on `chore/remove-expert-roles`. Five roles only. | Matches your list. |
| "BE-ARC-04 period keys" not done | **Mostly done**: W4a is live. `skill_assessments` has `appraisal_period_id` + new per-period unique keys. Migration B (drop old keys) and a 2nd period are **not** done. | Changes D5, see §5. |
| "Grade G13..G18 ramp" | Grades are **per department** (`grades.department_id`, ordered by `level`). | Ramp by `level`, not by code. |
| Docs folder updates | `documentation/` is hands-off until you say so | Write to `audit/` and repo `docs` only. |

---

## 2. What exists today (so we build on it)

**Backend reports we can reuse (all under `/api/v1/reports`):** `promotion-readiness`, `competency-scores`, `competency-matrix`, `gap-matrix`, `skills-summary`, `assessment-history`, `executive-summary`, `yoy-growth`, `gap-analysis/:empCode`. They are already scoped by role.

**Frontend screens today:** Admin Dashboard, Overview, Pending Approvals, Team Roster, Skill Assessments, CEFR Communication, AI Dashboard, Reports (many tabs), Setup, Skill Targets.

**Charts present:** Recharts only (radar, bullet row, stacked bar, ordinal meter). Palette in `lib/chartColors.ts` (validated).

**Data that exists:** employee, grade (`level`), department, line-manager assignments, department assignments, appraisal periods (code, dates, grace, status), skill assessment `status` (`approved` / `pending`), CEFR `status` (`draft` / `pending` / `approved`), `assessed_at`, `assessor_id`.

---

## 3. Dependencies: what is missing

### 3a. Missing in the app (must be built)

| # | Missing | Needed by | Real work |
|---|---|---|---|
| M1 | **`joined_at` on employees** | Tenure charts, "under 1 year" | Migration + admin field + import. Show "Unknown" when null. |
| M2 | **`designation` (job title)** | Org chart cards | Migration + admin field. |
| M3 | **Grade history table** | Time at grade, never promoted, ready-but-not-promoted | New table, write on every grade change, backfill "since unknown". |
| M4 | **`approved_at` / `approved_by`** | Calendar approvals, review velocity, approval outcomes, approval turnaround | Migration on skill + CEFR (+ behavioural if kept). |
| M5 | **`returned` / `rejected` status** | Approval outcomes donut | Today only `approved`/`pending` (`draft` for CEFR). Needs a product decision. |
| M6 | **Behavioural has no status, period or approver** (`behav_assessment`) | Behavioural pillar tile, pillar status grid | Behavioural is hidden from the menu. Decide: leave out, or add status + period. |
| M7 | **Analytics backend module** | Every dashboard | New `backend/src/modules/analytics/` with scoped aggregates, zod, tests. |
| M8 | **Period snapshots** (frozen scores at LOCK) | Sparklines, deltas, trend lines, top improvers | W4a gives period-keyed assessments, but **computed scores (`competency_scores`, `domain_scores`) have no period** and there is no snapshot table. Only one period (CY2026) exists, so trends would be empty anyway. |
| M9 | **Dashboard tokens** (`--hero-bg`, `--tile-*`, grade ramp) | KpiTile, hero, grade pills | Add to `styles/themes/tkxel-light.css` and `tkxel-dark.css` (names from `brand-palette.css`), plus values for the three hidden themes. Blueprint hex codes are not used. |
| M10 | **New shared components** (cut on 2026-10-15) | All | ChartCard (title + definition + help + View as table + CSV), SectionHeader, HeroBanner, ScopeSwitcher, CapsuleColumns, BarList, StripPlot, UnitMatrix, TrendLine, OrgChart, CalendarMonth, Avatar. Extend: `DashboardKpiCard` (KpiTile), `ui/matrix/` (StatusGrid letter cells), `StackedBar` (SegmentedBar). Reuse `BulletChartRow`, `OrdinalMeter`. |
| M11 | **A11y and perf test tools** | QA | `axe-core` is installed; `@axe-core/playwright` and Lighthouse CI are not. Playwright and `test:e2e:visual` exist. |
| M12 | **Scope switcher backing** | Department / My team / Me | Partly there: `getAccessibleEmployeeIds`. Needs "department" vs "my team" split per role. |
| M13 | **Small-group rule** (hide groups < 3 people) | All group charts | Needs your decision (blueprint default 3). |

### 3b. Already available (no work)

- Hierarchy (line-manager assignments), grade `level`, department.
- Period dates and status (hero, calendar milestones).
- Submitted time (`assessed_at`), pending vs approved counts.
- Promotion-ready, CEFR state (`cefr_state`), gap per person (from reports).
- Recharts, TanStack Query, Tailwind, lucide icons, Vitest, Playwright, HelpButton, Skeleton.
- Role guard + permission middleware, route-guard test.
- No cache server needed: use a small in-memory cache in the backend (no Redis exists).

### 3c. Library gaps

| Library | Present? | Use |
|---|---|---|
| Recharts | Yes | Trend, bars |
| d3 | **No** (not in `package.json`) | Not needed. Hand-roll SVG for StripPlot, CapsuleColumns, OrgChart connectors. |
| Calendar lib | No | Hand-roll CalendarMonth (7-column grid). |
| `@axe-core/playwright`, Lighthouse CI | **No** | Add as dev dependencies at D6. |

---

## 4. Rules from your memory that change the blueprint

1. **No fake data.** Blueprint sample numbers are for preview only. Absent data shows "Not assessed" or "Unknown", never a plausible number.
2. **Metric rule.** One definition of "ready" (all three checks). Target uses the same skills and weights as the score. Unassessed is never zero. Reuse report-row helpers; do not recompute in the new module.
3. **Never touch scoring formulas.** Analytics only *reads* scores. If a chart seems to need a formula change, stop and ask.
4. **Never show database IDs.** Show `emp_code`. Org chart and grids key on `emp_code`.
5. **Screen layout rules (§5c):** max 2 toolbars, no duplicate title/search/count, compact tables. Blueprint hero + chips + scope + section headers must fit this. Keep one toolbar row.
6. **Help on every screen/chart (§5e):** each ChartCard gets a HelpButton. The blueprint's "one-line definition" stays *and* gets a HelpButton.
7. **Component catalog, tests ≥ 80% on new code, Sonar gate** apply to every phase.
8. **Verify UI in a real browser** (screenshot) before calling a phase done.
9. **Version bump + ask before push/merge + backup master** for each release.
10. **Production database is read-only for me.** Migrations M1–M5 are written and rehearsed locally; you run them in prod.
11. **Compact UI:** blueprint 64 px avatars, 32 px KPI values and 20 px card padding need trimming to match current density.

---

## 5. Role dashboards

Scope rule everywhere: the **server** decides scope. The UI only shows what the API returns.

| Role | Who they are in code | Scope the API gives |
|---|---|---|
| ENGINEER | own record only | `me` |
| LINE_MANAGER | assigned reports (line-manager assignment), may assess | `me`, `team` |
| MANAGER | department assignment (view + manage) | `me`, `team`, `department` |
| TOP_MANAGEMENT | sees all, does not assess | `me`, `department`, `organization` |
| ADMIN | all + setup | `me`, `organization` + system health |

### 5.1 Engineer: "My Growth"
*Replaces `ResourceOverviewDashboard`. Scope: me only. No group stats at all.*

| Section | Widgets | Data today |
|---|---|---|
| Hero | Greeting, period + days left, status chips (e.g. "2 pending review") | Yes |
| At a glance (4 tiles) | Technical attainment vs target, CEFR level vs benchmark, promotion-ready yes/no with the blocking gap, assessments pending review | Yes |
| Three pillars | Technical, CEFR (and Behavioural only if M6 resolved) as one row each with target tick (BulletBar) | Yes |
| Where to grow | Top gaps (BarList): competency, gap, grade target | Yes (gap analysis) |
| Skills by domain | Domain bars or the existing radar | Yes |
| My assessments | Timeline of my submissions with status (draft / pending / approved) | Yes |
| My trend | Score per period with target line | **No** (M8; one period only). Show "Available after the next period closes". |
| Improvement plan | Open plan items | Yes (`improvement-plan` module) |

Not shown: department median or comparisons (open decision, needs M13).

### 5.2 Line Manager: "My Team"
*Scope: me + team.*

| Section | Widgets | Data today |
|---|---|---|
| Hero | Period, days left, chips: approvals waiting, assessed n/N, CEFR-gated, below target | Yes |
| Scope switcher | My team / Me | Yes |
| At a glance (8 tiles) | Team size, promotion-ready %, assessed n/N, **waiting on you**, CEFR certified %, avg technical attainment, stale (no update in 6 months), below target count | Yes (stale uses `updated_at`) |
| Assessment progress | UnitMatrix (one square per person: approved / pending / draft / not started) + SegmentedBar | Yes |
| Team attainment | StripPlot (one dot per person, target line, stats) | Yes |
| Skills matrix | StatusGrid people × skill domains, letter = level, ring = pending, filters + CSV | Yes (`competency-matrix`) |
| Largest gaps | BarList of team's top gaps | Yes |
| Pillar grid | People × (Technical, CEFR, Behavioural) = M / G / P | Technical + CEFR yes, Behavioural M6 |
| Schedule | Calendar: window, grace, lock, submissions per day | Submissions yes, approvals M4 |
| Review velocity | Submitted vs approved per week | Needs M4 |

*Rule kept:* a line manager's own skills need their own LM (see `LINE_MANAGER_SELF_ASSESMENT_RULE.md`). "Me" view follows it.

### 5.3 Manager (department manager): "My Department"
*Scope: me + team + department.*

Everything in 5.2 for the department, plus:

| Section | Widgets | Data today |
|---|---|---|
| Teams against target | BulletBar per line manager (avg attainment, target tick) | Yes |
| Per line manager table | Team size, avg attainment, On target / Below target, ready count, pending approvals, CEFR-gated | Yes |
| Span and review load | BarList: reports and pending approvals per line manager | Yes |
| Headcount by grade | CapsuleColumns by grade `level`, with ready overlay | Yes |
| Attainment distribution | CapsuleColumns bands (<60, 60–70, 70–80, 80–90, 90–100) + average pill | Yes |
| Team structure | OrgChart (name, emp_code, grade, N reports, pending badge) | Yes; job title needs M2 |
| Skill targets link | Shortcut to Skill Targets screen | Yes |
| Progression | Time at grade, ready-but-not-promoted | Needs M3 (+ M1 for tenure) |

### 5.4 Top Management: "Organization Health"
*Scope: department and organization. Read-only. No raw individual scores by default.*

Replaces the current "Health Overview" / executive summary feel, built from the same data.

| Section | Widgets | Data today |
|---|---|---|
| Hero | Period, days left, org-wide chips | Yes |
| At a glance | Headcount, promotion-ready %, assessed n/N, pending approvals backlog (org), CEFR certified %, avg technical attainment, stale, departments below target | Yes |
| Departments against target | BulletBar per department | Yes (`executive-summary`) |
| Pillar mix | Technical / CEFR / Behavioural readiness side by side | Technical + CEFR yes |
| Approval backlog | Pending by line manager (BarList), oldest pending age | Pending yes; age uses `assessed_at` (works today) |
| Headcount and seniority | Headcount by grade `level` + people-managers stat tile | Yes |
| Skill risk | Domains with the largest org-wide gap; most-assessed skills | Yes |
| Tenure and progression | Time at grade, stalled | Needs M1, M3 |
| Trends | Attainment and ready % by period vs target, top improvers | Needs M8 (D5) |
| Approval outcomes | Approved / pending / returned | Needs M4, M5 |

Suppress any group under the minimum size (M13).

### 5.5 Admin: "Admin Dashboard"
*Replaces `AdminDashboardTab.tsx`. Org scope plus system and data-quality health.*

| Section | Widgets | Data today |
|---|---|---|
| Top management view | Compact version of 5.4 | Yes |
| Setup completeness | Departments without grades, skills without targets, employees without a line manager, users without a role, grades without CEFR benchmark | Yes (counts from config tables) |
| Data quality | Employees with no assessment, stale assessments, missing `joined_at` / `designation` (after M1/M2) | Mostly yes |
| Period control | Active period, window, grace, lock status, % assessed | Yes |
| Access and activity | Users by role, locked accounts, last logins, recent access audit events | Yes (`access_audit_logs`, `users`) |
| AI usage | AI insights calls and fallbacks | Needs check; no usage table seen |
| Scoring config | Link to level weights and credits (DB-only) | Yes |

---

## 6. Shared analytics API (new)

All under `backend/src/modules/analytics/`, mounted at `/api/v1/analytics`. Every endpoint: authenticate, zod query, scope from `accessScopeService`, role guard (so the route-guard test passes), tests per role, 60-second in-memory cache keyed by user, scope, period.

| Endpoint | Serves |
|---|---|
| `GET /overview?scope=&periodId=` | Hero, status chips, KPI tiles (all roles) |
| `GET /appraisal-progress` | Unit matrix, status mix, weekly velocity |
| `GET /attainment` | Bands, strip dots, stats row (mean, median, P25, P75, P90, SD, N) |
| `GET /teams` | Per line manager table, bullet data, review load |
| `GET /structure` | Org tree, span, headcount by grade, tenure bands |
| `GET /progression` | Time at grade, ready-but-not-promoted |
| `GET /matrix?pillar=` | StatusGrid cells |
| `GET /calendar?month=` | Milestones and per-day counts |
| `GET /system-health` | Admin only |
| `GET /trends` | Later (D5) |

**Reuse rule:** `promotion_ready`, `cefr_state` and gap numbers come from the existing report helpers (`report-row.helpers.ts`, `scoring/reporting.engine.ts`). The analytics module must not compute a second version of any metric.

---

## 7. Phases (adjusted to the real app)

Order and sizes follow the blueprint, with the data work split so you can say yes or no to each migration.

| Phase | Name | Depends on | Effort | Notes |
|---|---|---|---|---|
| **D-A** | Dashboard kit: tokens + components | none | 3–4 days | Tokens in the tkxel theme files (+ hidden themes). 12 new components in `ui/dashboard/` and `ui/charts/`, extend 3. Vitest tests; catalog entries; `HelpButton` text. No gallery route. Branch from `origin/master`. |
| **D-B** | Analytics API v1 (no new tables) | none | 4–5 days | `overview`, `appraisal-progress`, `attainment`, `teams`, `matrix`, `structure` (without tenure/title), `system-health`. Uses data that exists today. |
| **D-C** | Engineer + Line Manager dashboards | D-A, D-B | 3–4 days | §5.1 (assemble from `MyReport` / `?scope=self`), §5.2 (upgrade `LineManagerTeamPanel` with the review items first) |
| **D-D** | Manager + Top Management dashboards | D-A, D-B, D-C | 4–5 days | §5.3, §5.4 |
| **D-E** | Admin dashboard | D-A, D-B | 2–3 days | §5.5 |
| **D-F** | Data additions (M1–M4) | your decision | 4–5 days | Migrations written and rehearsed locally. You run in prod. Unlocks tenure, time at grade, calendar approvals, velocity. |
| **D-G** | Workforce + Schedule screens | D-F | 4–5 days | Org chart titles, progression, calendar, velocity |
| **D-H** | Trends | M8 + a 2nd period | 3–4 days | Period score snapshots. Cannot show real data until CY2026 locks and a 2nd period exists. |
| **D-I** | QA | all | 2–3 days | `@axe-core/playwright` added, keyboard walk, screenshot baselines at 375 and 1280 in `tkxel` and `tkxel-dark` (hidden themes smoke-checked), perf budget |

D-A to D-E give every role a working dashboard **with no database change**. D-F to D-H add the rest.

---

## 8. Decisions I need from you

1. **Scope of the first release:** build D-A → D-E now (no DB change), and hold D-F onward? *(Recommended)*
2. **Migrations M1–M4** (`joined_at`, `designation`, grade history, `approved_at/by`): approve? M1/M3 need an HR data source or show "Unknown / since unknown".
3. **Behavioural pillar (M6):** hidden from menu and has no status or period. Leave out of dashboards, or add status + period?
4. **"Returned" status (M5):** add it, or keep approve-only?
5. **Smallest group size** for aggregates: 3?
6. **Engineer comparison:** may an engineer see "your score vs department median" (only when group ≥ 3)?
7. ~~Prism look~~ **Settled:** tkxel tokens only; blueprint colours are not used.
8. **Top Management:** can they see named individuals in charts (strip plot, matrix), or only aggregates?
9. **Navigation:** keep one "Overview" tab per role (recommended, fits the single-page app), or add new tabs (Workforce, Schedule)?
10. **Target values:** the blueprint uses a "75% target". Use the grade target from the DB per person, and the department average target for group lines. Confirm.

---

## 9. Risks

- **Two sources of one metric.** The biggest past defect class. Mitigation: analytics reads report helpers; the `audit` skill `definitions` pass runs at the end of each phase.
- **Trends are empty for now.** Only CY2026 exists. Do not draw a line from one point.
- **Group size 1–2 leaks a person's score.** Suppression must be server-side, with a test per role.
- **Density.** Blueprint spacing is looser than the app's compact rules. Trim during D-A.
- **Five themes.** Every new token needs a value in `tkxel`, `tkxel-dark` and the three hidden themes (they must keep working). Charts follow the base theme via `useChartTheme`.
