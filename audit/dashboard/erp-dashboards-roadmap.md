# ERP Dashboards and Analytics Roadmap

| | |
|---|---|
| **Date** | 2026-10-08 |
| **Reference** | 9 screenshots of the department and line-management tool. Its pages:<ul><li>org chart</li><li>structure and progression</li><li>at-a-glance KPIs</li><li>WFH calendar</li><li>department home</li><li>standup trends</li><li>attendance grid</li><li>Tech Camp</li><li>per-manager comparison</li></ul> |
| **Goal** | Bring the same kind of graphs, charts and dashboards into ERP. Use ERP's appraisal data, restyled in the **ERP Prism** system (`erp-audit-2026-10-06.md` §10). |
| **Builds on** | The audit's phases **UI-4** (chart system), **UI-5** (dashboards), **P2** (appraisal integrity, including BE-ARC-04) and **P3** (read models) |
| **Privacy** | This plan copies the reference's *structure and style* only. It contains no names or figures from the screenshots, and none should go into ERP's code, fixtures or tests. |

---

## 1. What the reference does well (keep these)

1. **Every chart explains its own metric.** Under each title there is a one-line definition, for example "present ÷ (present + absent)" or "anyone with a direct report counts as a people manager". This is the single most valuable habit to copy, because ERP's scores are formula-driven and people need to know what a number means.
2. **"View as table" under every chart.** Each chart has an accessible data alternative. It matches the ChartFrame planned in UI-4.
3. **Answer first.** Each page opens in this order:
   1. a greeting or hero with status chips (*"No approvals waiting"*, *"9 below 80%"*)
   2. KPI tiles
   3. detail charts
   4. tables
4. **Section headers with a short accent bar** ("At a glance", "Structure", "Progression", "This month", "Schedule"). They group the long scroll into named chapters.
5. **Targets drawn into the chart:**
   - a dashed target line on trends
   - a tick on bullet bars
   - a shaded "below target" band on the strip plot
   - "On target / Below target" labels in tables
6. **The data voice is consistent:**
   - Monospaced, tabular numerals for every value.
   - Counts sit above the columns, and percentage pills sit inside them.
   - Ordinal axes have end labels ("Junior … Senior", "Newest … Longest serving").
7. **State is shown by shape and letter, not color alone.** The attendance grid cells carry `A`, `L`, `C`, `OS`, and pending days are hollow rings. That is good accessibility practice.
8. **Distribution statistics are shown under the distribution:** mean, median, P25, P75, P90, standard deviation and N under the strip plot.
9. **A scope switcher at the top:** *Department / Workforce / You*.

**Change three things when bringing it over:**
- **Grades are ordinal, so they need one ordered ramp of a single hue.** The reference colors grades with unrelated hues (cyan, periwinkle, purple). ERP uses the sequential brand-blue ramp, so G13 is lightest and G18 darkest, for both grade pills and grade charts.
- **Two-slice donuts become stat tiles or a 100% bar.** ERP's own STANDARDS §8 already says this. Keep donuts only for 3–5 part outcomes, such as approved, pending and rejected.
- **Solid KPI tiles need white text at 4.5:1 or better.** Use the darker Prism fills in §4. The reference's mid-teal and bright green tiles fall below this for small text.

---

## 2. Pattern catalog: reference widget → ERP widget

| # | Reference widget | ERP equivalent | Who sees it | Data today | Phase |
|---|---|---|---|---|---|
| 1 | **Org chart.** Manager card with avatar, name, title, grade pill and "N reports". Direct reports as compact rows with grade chip, code and title. | **Team structure tree.** Cards add a mini three-pillar readiness ring and a "pending approvals" badge. Clicking a person opens their profile. | Leaders, Admin | ✅ hierarchy (line-manager assignments), grade, code<br>❌ **job title** | D3 (title needs D0) |
| 2 | **Span of control** bar list | **Span of control** plus **review load per line manager** (direct reports and pending approvals) | Dept manager, Top management, Admin | ✅ | D3 |
| 3 | **Who leads people** donut (two slices) | **Stat tile** "4 people managers · 22 individual contributors", or a 100% bar | Admin, Top management | ✅ | D3 |
| 4 | **Time at current grade**, banded, with risky bands in a warning color | **Time at current grade**, banded. "Never promoted > 24 months" uses the *serious* status color with an icon. | Leaders | ❌ **grade history** | D3 (needs D0) |
| 5 | **Longest without a grade move** table | **Ready but not promoted**: promotion-ready people with the longest time since readiness, then the longest at grade | Leaders | ⚠ readiness ✅, grade history ❌ | D3 |
| 6 | **At a glance**: 8 solid KPI tiles with icon chip, number, caption and status chip | **At a glance**, per scope:<ul><li>Headcount in scope</li><li>Promotion-ready %</li><li>Assessed this period (n / N)</li><li>Waiting on you (approvals)</li><li>CEFR certified %</li><li>Behavioral at or above target %</li><li>Stale (no assessment update in 6 months)</li><li>Average technical attainment</li></ul> | All (scoped) | ✅ (Stale uses `updated_at`) | D2 |
| 7 | **Headcount by grade**: capsule columns with track, count on top and % pill | **Headcount by grade**, plus a **readiness overlay** (the share of each grade that is promotion-ready, as an inner fill) | Leaders | ✅ | D2 |
| 8 | **Tenure distribution** capsule columns | **Tenure distribution** | Leaders | ❌ **joining date** | D3 (needs D0) |
| 9 | **Gradient hero banner** with title, explanation and a big stat on the right | **Appraisal period hero**: "CY2026 review · 18 days left in the submission window · 62% assessed". Uses the Prism gradient. | All | ✅ period dates and status | D2 |
| 10 | **Month calendar** with avatar chips per day, approved/pending/holiday legend, Calendar/List toggle, "+2 more" | **Appraisal calendar**:<ul><li>period window, grace end and lock date</li><li>assessments submitted and approved per day</li><li>CEFR sessions due</li></ul>Calendar/List toggle. Pending items are hollow. | Line managers, Leaders | ⚠ submitted ✅ (`assessed_at`), approved ❌ (**approved_at**) | D4 (approvals need D0) |
| 11 | **Greeting hero** with date, fiscal period and status chips | **Home greeting**: "Good evening, {first name} · {period} · closes in 12 days". Chips: *7 approvals waiting · 18/26 assessed · 3 CEFR-gated · 4 below target*. | All | ✅ | D2 |
| 12 | **Scope tabs**: Department / Workforce / You | **Scope switcher**: *Department / My team / Me*. The options come from role and scope; an engineer sees only *Me*. | All | ✅ | D2 |
| 13 | **KPI tile with sparkline**, delta "▲ +1.8 pts vs Sep" and target text | **Attainment and readiness tiles** with a per-period sparkline and a delta vs the previous period | Leaders, Me | ❌ needs **period snapshots** (BE-ARC-04) | D5 |
| 14 | **Unit (dot) matrix**: Present 15/25 as squares | **This period's assessments**: one square per person, in four states: approved, pending, draft, not started | Line managers, Leaders | ✅ | D2 |
| 15 | **Segmented status bar** with counts | **Assessment status mix** (approved / pending / draft / rejected / not started) | Line managers, Leaders | ✅ | D2 |
| 16 | **Trend line** with a dashed target, crosshair tooltip and empty future months | **Attainment and CEFR-certified % by period** vs target; the current period is highlighted and future periods are empty | Leaders, Me | ❌ snapshots | D5 |
| 17 | **Teams against target**: bullet bars with a target tick | **Teams against target**: average technical attainment, or % promotion-ready, per line manager, with a target tick | Dept manager, Top management | ✅ | D2 |
| 18 | **Distribution capsule columns** with an average pill | **Attainment distribution**: people per attainment band (<60, 60–70, 70–80, 80–90, 90–100), with an average pill | Leaders | ✅ | D2 |
| 19 | **Weekly bar chart** with legend | **Review velocity**: assessments submitted vs approved per week during the window | Line managers, Leaders | ⚠ approved needs D0 | D4 |
| 20 | **People × day status grid** with letter-coded cells and today highlighted | **Skills matrix heatmap**: people × skill domains. The cell carries a level letter (E/A/P/F/B/W, U = unset), with color = attainment vs target on the diverging ramp and hollow = pending. Also a **pillar status grid**: people × (Technical, CEFR, Behavioral) with M = met, G = gap, P = pending. | Line managers, Leaders | ✅ | D4 |
| 21 | **Top-N bar lists** (top presenters, lowest standup) | **Largest gaps to target**, **most-assessed skills**, and **top improvers** (improvers need snapshots) | Leaders | ✅ / D5 | D2 / D5 |
| 22 | **Outcome donut** with center % (3 parts) | **Approval outcomes this period**: approved / pending / returned, with the center showing % approved | Leaders | ⚠ "returned" needs a status | D4 |
| 23 | **Strip (dot) plot** with target line, shaded below-target zone and a statistics row | **Everyone's technical attainment this period**: one dot per person, target line, statistics row (mean, median, P25, P75, P90, standard deviation, N). Also offered per pillar. | Leaders | ✅ | D2 |
| 24 | **Per-manager comparison table** with "On target / Below target" status | **Per line manager**: team size, average attainment, against target, promotion-ready count, pending approvals, CEFR-gated count | Dept manager, Top management, Admin | ✅ | D2 |

---

## 3. Data gaps and backend work (Phase D0, inside engineering P2)

| Gap | Needed for | Change |
|---|---|---|
| No joining date | Tenure distribution, "under 1 year" KPI | `employees.joined_at DATE NULL`, plus admin UI and import. Show "unknown" where it is null; never guess it from `created_at`. |
| No grade history | Time at grade, never promoted, stalled, ready-but-not-promoted | New `employee_grade_history` table (employee_id, grade_id, effective_from, effective_to, changed_by, reason). Write to it on every grade change. Backfill one open row per employee from the current grade, marked "since unknown". |
| No job title | Org chart cards | `employees.designation VARCHAR NULL` |
| No approval timestamp or approver | Calendar approvals, review velocity, approval outcomes | `approved_at`, `approved_by` (user FK) and a `returned` status on all three assessment types. Already part of BE-ARC-09. |
| No per-period history | Sparklines, deltas, trends, top improvers, YoY | **BE-ARC-04** period keys and snapshot on LOCK (audit §6A). It has to land before D5. |
| Dashboards would hammer reports | Every dashboard | **Analytics endpoints** that return aggregates, not raw rows, scoped by `accessScopeService` (see below) |

### Analytics API (new module `src/modules/analytics`)

Every endpoint follows these rules:
- It is scoped server-side to the caller.
- It is validated with zod.
- It is cached for 60 seconds per (user, scope, period).
- It is covered by the RBAC matrix test.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/analytics/overview?scope=department\|team\|me&periodId=` | KPI tiles, hero numbers, status chips |
| `GET /analytics/appraisal-progress` | Status mix, unit-matrix rows, weekly velocity |
| `GET /analytics/attainment` | Bands, strip-plot values and the statistics row (computed on the server) |
| `GET /analytics/teams` | Per-line-manager comparison and bullet data |
| `GET /analytics/structure` | Org tree, span of control, headcount by grade, tenure bands |
| `GET /analytics/progression` | Time at grade, ready-but-not-promoted |
| `GET /analytics/matrix?pillar=` | People × domain cells |
| `GET /analytics/calendar?month=` | Period milestones and per-day submitted and approved |
| `GET /analytics/trends` (D5) | Per-period series from snapshots |

**Privacy rule (HR analytics):** suppress any group aggregate below 3 people, showing "Fewer than 3 people". Engineers only ever get `scope=me`. Never include another person's individual scores outside the caller's access scope.

---

## 4. Visual specification (Prism, matched to the reference look)

All tokens come from `erp-audit-2026-10-06.md` §10.7. These are the additions for the dashboard kit:

```css
/* Solid KPI tile fills: white text ≥ 4.5:1 at the lightest stop */
--tile-technical:  linear-gradient(135deg, #1D46F3, #0A2DC1); /* 6.5:1 */
--tile-cefr:       linear-gradient(135deg, #0F766E, #115E59); /* 5.5:1 */
--tile-behavioral: linear-gradient(135deg, #C2410C, #9A3412); /* 5.2:1 */
--tile-ai:         linear-gradient(135deg, #6D28D9, #5B21B6); /* 7.1:1 */
--tile-success:    linear-gradient(135deg, #15803D, #166534); /* 5.0:1 */
--tile-neutral:    linear-gradient(135deg, #1E293B, #0B1630); /* KPI not tied to a pillar */
--hero-period:     linear-gradient(120deg, #0A2DC1 0%, #1D46F3 55%, #0F766E 100%);
--hero-greeting:   linear-gradient(120deg, #061E81 0%, #1D46F3 60%, #6D28D9 100%);
/* Grade ramp (ordinal, one hue): G13 → G18 */
--grade-1:#B4CCF8; --grade-2:#86A8F5; --grade-3:#4D7BFF; --grade-4:#1D46F3; --grade-5:#0A2DC1; --grade-6:#061E81;
/* Capsule track and bar-list track */
--track: var(--surface-3);
```

**Component rules:**

| Component | Specification |
|---|---|
| **ChartCard** | <ul><li>Title: `title`, 16/600.</li><li>Definition line: `body-sm`, text-3.</li><li>Then the chart, then a footer with "View as table" (and Export).</li><li>Radius 12, `e1` shadow, 20 px padding.</li><li>The title row may hold one action link, e.g. "Approvals ›".</li></ul> |
| **SectionHeader** | 3 × 14 px rounded bar in `--primary` plus a `title` label. Chapters on each dashboard: *At a glance · Appraisal progress · Attainment · Teams · Structure · Progression · Schedule.* |
| **KpiTile** | <ul><li>Solid tile fill.</li><li>Icon chip top-right (white at 18% opacity, radius 8).</li><li>Label 13/600.</li><li>Value in **JetBrains Mono 600, 32 px, tabular**.</li><li>Caption 12/500 at 85% white.</li><li>Optional status chip (white pill with status text color, e.g. "Stalled").</li><li>Optional sparkline: 2 px white line, 20% white area, endpoint dot.</li><li>Optional delta "▲ +1.8 pts vs CY2025" with the arrow plus text, never color alone.</li></ul> |
| **CapsuleColumns** | <ul><li>Full-height track.</li><li>Fill from the bottom.</li><li>Count above in mono 12.</li><li>% pill inside the top of the fill (white pill, 11 px mono).</li><li>Category label below.</li><li>Optional end labels on the axis.</li><li>Gap equal to the column width.</li></ul> |
| **BarList** | <ul><li>Label (truncated with a tooltip).</li><li>8 px track with fill.</li><li>Value right-aligned in mono.</li><li>Optional semantic fill for risky rows (serious color plus a ⚠ icon).</li><li>Rows are 28 px.</li></ul> |
| **BulletBar** | <ul><li>Track.</li><li>Actual-value fill.</li><li>2 × 16 px target tick in `--text-1`.</li><li>Value at right.</li><li>Label "Name · team size" above.</li></ul> |
| **StripPlot** | <ul><li>One 8 px dot per person, stacked when values collide.</li><li>Dashed target line.</li><li>Below-target zone shaded with `danger-soft` at 50%.</li><li>Statistics row in mono beneath.</li><li>Hover shows name and value (in scope only).</li></ul> |
| **StatusGrid** | <ul><li>Rows are people, columns are domains or pillars.</li><li>Rounded 18 px cells with a letter code.</li><li>Hollow ring for pending.</li><li>Sticky first column.</li><li>Legend with letter and color.</li><li>Keyboard grid navigation.</li></ul> |
| **UnitMatrix** | <ul><li>10 px squares, one per person.</li><li>Four states with distinct fill and shape: filled, half, outline, dotted.</li><li>The state counts double as a legend.</li></ul> |
| **SegmentedBar** | <ul><li>10 px bar.</li><li>2 px surface gaps between segments.</li><li>Counts underneath as big mono numbers with a colored dot and label.</li></ul> |
| **TrendLine** | <ul><li>2 px line with area fill from Prism blue at 25% down to 0.</li><li>Dashed target line with a label.</li><li>Crosshair tooltip.</li><li>Future periods empty but labelled.</li><li>Legend for 2 or more series.</li></ul> |
| **OrgChart** | <ul><li>Root and manager cards: 64 px avatar initials on `primary-soft`, name, title, grade pill (grade ramp), "N reports", plus a mini three-pillar ring and a pending badge.</li><li>Leaves are compact rows.</li><li>1.5 px connectors in `--border-strong`.</li><li>Collapse and expand per manager.</li><li>Fits the screen by horizontal scroll inside its own container.</li><li>A search box highlights a person.</li></ul> |
| **CalendarMonth** | <ul><li>A 7-column grid; weekends are muted.</li><li>Today has a 2 px `--focus` ring.</li><li>Chips are avatar initials plus a name; "+N more" opens a popover.</li><li>Legend uses shapes: solid = approved, dashed ring = pending, dot = milestone.</li><li>Calendar/List toggle.</li></ul> |
| **Avatar initials** | Background from the person's department, using a deterministic hash into 6 *light* tints with dark text (≥ 4.5:1). Never white on mid-tones. |

**Charts never:**
- use two y-axes
- cycle colors
- put a number on every point
- color text with a series color

These are from the dataviz rules in audit §10.4.

---

## 5. Dashboard layouts

### 5.1 Home (everyone; replaces today's Overview)

1. **Greeting hero** (`--hero-greeting`) with status chips. Each chip is a link: "7 approvals waiting" opens Approvals.
2. **Scope switcher:** *Department · My team · Me*. Defaults to the widest scope the role has.
3. **At a glance:** 8 KPI tiles in a 4-column grid (2 columns on tablet, 1 on phone).
4. **Appraisal progress:**
   - period hero (`--hero-period`)
   - unit matrix
   - segmented status bar
   - review velocity (D4)
5. **Attainment:**
   - attainment distribution capsules
   - strip plot with the statistics row
   - largest-gaps bar list
6. **Teams** (department scope):
   - teams against target (bullet)
   - per-manager comparison table
7. **Me** (every role): pillar triad, my readiness checklist, my assessments timeline.

### 5.2 Workforce (Leaders, Admin): new route `/app/workforce`

- **Structure:** org chart, span of control, people-managers stat, headcount by grade (with readiness overlay), tenure distribution.
- **Progression:** time at current grade, ready but not promoted, longest at grade.

### 5.3 Skills matrix (Line managers, Leaders): upgrade of today's competency matrix report

People × domains status grid, with filters for department, grade and pillar. It has a "View as table" option and CSV export.

### 5.4 Schedule (Line managers, Leaders)

The appraisal calendar, with a Calendar/List toggle and approval outcomes.

---

## 6. Phased roadmap

| Phase | Name | Depends on | Effort | Scope |
|---|---|---|---|---|
| **D0** | Analytics data foundations (BE) | P1; runs inside P2 | 5–7 days | §3 schema additions, grade-history backfill, `approved_at`/`approved_by`/`returned`, analytics module and endpoints (except trends), small-group suppression, RBAC tests |
| **D1** | Dashboard component kit (FE) | UI-1, UI-3, UI-4 | 5–6 days | All §4 components in `src/components/ui/dashboard/` and `ui/charts/`, each with a story in `/dev/components`, light and dark, a table view, and keyboard support |
| **D2** | Home and Department dashboards | D0, D1, UI-2 | 5–6 days | §5.1 sections 1–7, catalog rows 6, 7, 9, 11, 12, 14, 15, 17, 18, 21, 23, 24 |
| **D3** | Workforce: structure and progression | D0, D1 | 4–5 days | §5.2, catalog rows 1–5, 8 |
| **D4** | Skills matrix, schedule and approvals analytics | D0, D1 | 4–5 days | §5.3, §5.4, catalog rows 10, 19, 20, 22 |
| **D5** | Trends and period-over-period | **BE-ARC-04 snapshots (P2)**, ideally P3 read models | 3–4 days | `/analytics/trends`, sparklines and deltas on KPI tiles, trend lines with target, top improvers, YoY slope chart; catalog rows 13, 16, 21 |
| **D6** | Dashboard QA | D2–D5 | 2–3 days | axe on every dashboard (light and dark), keyboard walkthroughs, screenshot baselines at 375 and 1280 px, performance budget (dashboard LCP < 2.5 s, analytics p95 < 300 ms), scope and suppression tests |

**Where it sits in the master plan:**
- D0 runs inside **P2** (backend).
- D1 follows **UI-4**.
- **D2, D3 and D4 replace UI-5**, which defined the role dashboards in general terms. Do D2 first, then D3 and D4 in either order.
- D5 runs after P2 lands.
- D6 merges into **UI-8**.

---

## 7. Claude Code prompts

Run each prompt in the repo named. Paste the audit's §12 shared UI guardrails first for frontend phases. The master prompt's rules still apply: one branch per phase, tests first for scope, a 🛑 checkpoint at the end of each phase, and no real names or data in fixtures.

### D0: Analytics data foundations (`erp-be`, branch `feat/d0-analytics-data`)

```text
Read erp-dashboards-roadmap.md §3 and erp-audit-2026-10-06.md §6A. Implement:
1. Prisma migration: employees.joined_at DATE NULL, employees.designation VARCHAR(120) NULL; new model EmployeeGradeHistory (id, employee_id FK, grade_id FK, effective_from DATE NULL, effective_to DATE NULL, since_unknown BOOLEAN default false, changed_by user FK NULL, reason TEXT NULL, created_at) with index (employee_id, effective_to). Backfill: one open row per active employee at current_grade_id with since_unknown=true. From now on every change to employees.current_grade_id (config.service updateEmployee and any bulk path) closes the open row and opens a new one in the same transaction.
2. Add approved_at TIMESTAMPTZ NULL, approved_by INT NULL (FK users) to skill, CEFR and behavioral assessments; set them on approve; add 'returned' as an allowed status where a manager sends an assessment back (with reason). Keep existing statuses working.
3. New module src/modules/analytics (router, controller, service, schema, tests) with the endpoints in §3. Every endpoint: authenticate, zod-validated query (scope enum, periodId, month), scope resolved through accessScopeService (engineers may only use scope=me; return 403 otherwise), aggregates computed in SQL/Prisma groupBy (no N+1, no full raw-row responses), groups below 3 people return {suppressed:true}, 60-second in-memory cache keyed by (userId, scope, periodId, endpoint) invalidated on assessment writes. Strip-plot values for people outside the caller's scope must never be returned.
4. Tests: supertest per endpoint × role (ADMIN, TOP_MANAGEMENT, MANAGER, LINE_MANAGER, ENGINEER) for scope; suppression; grade-history open/close on change; approved_at set on approve. Fixtures use fake names only.
5. Document the endpoints (zod → OpenAPI if Phase 3 is done; otherwise a markdown table in docs/analytics-api.md).
Stop at the end with a summary and the list of contract additions for the frontend.
```

### D1: Dashboard component kit (`erp-fe`, branch `ui/d1-dashboard-kit`)

```text
Read erp-dashboards-roadmap.md §1 and §4 and erp-audit-2026-10-06.md §10. Add the §4 tokens to src/styles/tokens.css (light and dark). Build these components with TypeScript props, no hard-coded colors, light/dark support, and a DEV gallery entry each: ChartCard (title, definition, actions, "View as table" toggle rendering an accessible <table>, export CSV), SectionHeader, KpiTile (variants technical|cefr|behavioral|ai|success|neutral; icon, label, value, caption, status chip, optional sparkline + delta), HeroBanner, GreetingHero (status chips as links), ScopeSwitcher (radiogroup, arrow keys), CapsuleColumns (counts above, % pill, end labels), BarList, BulletBar (target tick), StripPlot (collision stacking, target line, shaded below-target band, stats row computed by a pure tested function: mean, median, P25, P75, P90, std dev, N), StatusGrid (letter-coded cells, hollow pending, sticky first column, roving-tabindex keyboard navigation), UnitMatrix (four shape-distinct states), SegmentedBar, Donut (3–5 parts only; throws in dev for 2), TrendLine (Recharts; target reference line; crosshair tooltip; empty future periods), OrgChart (collapsible tree, search highlight, horizontal scroll container, cards and compact rows), CalendarMonth (+N more popover, Calendar/List toggle), Avatar (deterministic light tint with dark text). Every chart: role="img" with a generated summary, legend for ≥2 series, values in tabular mono, colors from tokens only. Unit tests for the pure helpers (stats, banding, stacking, avatar tint contrast ≥ 4.5:1), and render tests for keyboard behaviour.
```

### D2: Home and Department dashboards (`erp-fe`, branch `ui/d2-home-dashboard`)

```text
Build the Home dashboard from erp-dashboards-roadmap.md §5.1 using the D1 kit and the D0 endpoints (react-query hooks via a key factory, invalidated by assessment mutations). Sections in order: GreetingHero with status chips (each links to its screen), ScopeSwitcher (department / team / me, options from role and scope, persisted in the URL query), At a glance (8 KpiTiles from catalog row 6), Appraisal progress (period HeroBanner, UnitMatrix, SegmentedBar), Attainment (CapsuleColumns bands with average pill, StripPlot with stats row and target, BarList of largest gaps), Teams (BulletBar teams vs target, per-manager comparison table with On target / Below target status icon+text), Me (pillar triad, readiness checklist, my assessments). Every chart inside a ChartCard with a one-line definition of the metric written in plain language (e.g. "Average technical attainment = mean of competency scores ÷ grade target, approved assessments only"). Loading skeletons per card, EmptyState and ErrorState with retry, suppressed groups shown as "Fewer than 3 people". Responsive 4/2/1 columns. Playwright: each role sees only its allowed scopes; axe clean in light and dark; screenshots at 375 and 1280.
```

### D3: Workforce structure and progression (`erp-fe`, branch `ui/d3-workforce`)

```text
Add route /app/workforce (Leaders, Admin) per erp-dashboards-roadmap.md §5.2: Structure — OrgChart from /analytics/structure (manager cards with grade pill on the grade ramp, N reports, mini three-pillar ring, pending badge; collapse/expand; search), BarList span of control and review load, people-managers stat tile, CapsuleColumns headcount by grade with readiness overlay and Junior…Senior end labels, CapsuleColumns tenure distribution (unknown joining dates shown as their own "Unknown" column, never guessed). Progression — BarList time at current grade with serious-status fill and ⚠ icon on the >24-month and never-promoted bands, table "Ready but not promoted" (person, grade pill, ready since, at grade since; "since unknown" where backfilled). Admin form fields for joined_at and designation in the employee editor. Tests and screenshots as in D2.
```

### D4: Skills matrix, schedule and approval analytics (`erp-fe`, branch `ui/d4-matrix-schedule`)

```text
Per erp-dashboards-roadmap.md §5.3–5.4: (1) Replace the competency matrix report view with StatusGrid: rows people, columns skill domains (or pillars via a toggle), cell letter = level code (E/A/P/F/B/W/U) or pillar status (M/G/P), cell color = attainment vs target on the diverging ramp, hollow ring = pending; filters department/grade/pillar; sticky first column; keyboard grid; View as table; CSV export. (2) Schedule page: CalendarMonth of the active period (window start, submission end, grace end, lock milestones; per-day submitted and approved avatar chips, pending hollow), Calendar/List toggle, review-velocity weekly bars (submitted vs approved), approval-outcomes Donut (approved/pending/returned) with a link to Approvals. Tests and screenshots as in D2.
```

### D5: Trends and period-over-period (`erp-be` then `erp-fe`, branch `feat/d5-trends`)

```text
Precondition: BE-ARC-04 period keys and LOCK snapshots are merged (verify; stop and tell me if not). Backend: GET /analytics/trends returning per-period series from period snapshots only (never recomputed with current weights) for attainment, promotion-ready %, CEFR certified %, behavioral at/above target %, scoped and suppressed like D0. Frontend: sparkline + delta ("▲ +1.8 pts vs CY2025", arrow + text) on KpiTiles; TrendLine per metric with dashed target and empty future periods; BarList "Top improvers" (delta between the last two locked periods, in scope only); YoY slope chart for department scope. Tests: trend values for a locked period stay identical after a scoring-config change.
```

### D6: Dashboard QA (`erp-fe`, merge into UI-8)

```text
Add @axe-core/playwright checks (0 serious/critical) for Home, Workforce, Skills matrix and Schedule in light and dark for every role fixture; keyboard-only walkthrough (scope switch → open a chart's table view → navigate the status grid → open a calendar day popover); toHaveScreenshot baselines at 375 and 1280; Lighthouse CI budget (dashboard LCP < 2.5 s, CLS < 0.05); a test that an ENGINEER session never receives another person's values from any /analytics endpoint.
```
