---
name: software-auditor
description: >-
  Full read-only audit of a codebase in any language or stack. Use when the user asks
  for a codebase audit, health check, technical-debt assessment, security posture
  review, or "how good is this application". Scores Architecture, Security, Auth,
  Domain & Data Integrity, Code Quality, Testing, Dependencies, Performance,
  Operations, and UI/UX against the project's own rules plus industry practice, then
  writes an interactive HTML dashboard, a wave-ordered REMEDIATION_PLAN.md, and a
  machine-readable JSON snapshot for tracking change between runs.
  Not for reviewing a single pull request or diff — use the PR review skills for that.
---

# Universal Software Audit & Report Generator

Run this workflow without stopping to ask questions. Inspect the target repository, record findings backed by evidence, and produce the three output files described in Phase 7.

## ⛔ Execution Rules

1. **Read-only audit.** Do not modify, reformat, move, or delete any project file. The only files you may write are the outputs in the `audit/` folder at the workspace root (see Phase 7).
2. **Use read tools first.** Use the agent's built-in read, search (grep/glob), and list-files tools. Use the shell only for read-only discovery (`ls`, `find`, `grep`, `wc`, `git log`, `git ls-files`, `git status`). Do not install packages, make network calls, start servers, or run database commands.
3. **Optional command checks (off by default).** Run the project's type-check, lint, test, or dependency-audit commands **only if the user asked for them** (e.g. "run checks", "full audit with tests"). They write caches or need the network. When run, record the command and a short summary of the output as evidence.
4. **Run to completion.** Do not pause for confirmation. If something cannot be checked, record it under Scope & Limitations and continue.
5. **Never copy secrets.** If you find a credential, token, password, private key, or connection string, report only its location and a masked form (e.g. `sk_live_****abcd`, `postgres://user:****@host`). Never put the full value in any output.
6. **Evidence only.** Report only issues you confirmed by opening the code. Do not report issues from file names, guesses, or general assumptions.

---

## Phase 0: Load Project Rules & Context

Before judging the code, learn what the project says "correct" means. Read, if present:

- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md`
- `DESIGN.md`, `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`
- Everything in `documents/`, `docs/`, or `adr/` that describes rules, architecture, or domain behavior

Extract a numbered list of **Project Rules** (e.g. `PR-01: Posted vouchers are immutable; corrections use reversal`). These are audit criteria with the same weight as industry practice. Any finding that breaks a Project Rule must cite it in `ruleRef`.

If a previous audit exists (`audit/audit-data.json`, or older `audit-report.html` / `REMEDIATION_PLAN.md` at the root), load it for the comparison in Phase 6.

## Phase 1: Map the Codebase & Plan Coverage

1. List tracked files (`git ls-files`, or a recursive listing that skips `node_modules`, `dist`, `.next`, `build`, `vendor`, `target`, `coverage`).
2. Count files and lines per top-level area (e.g. `frontend/src/components`, `backend/src/modules`, `prisma/`).
3. Identify entry points: HTTP routes, pages, background jobs, CLI scripts, migrations, seeds, Dockerfiles, CI workflows.
4. **Rank areas by risk** and audit in this order:
   1. Authentication, authorization, multi-tenant/company scoping
   2. Money, posting, stock, and other state-changing business logic
   3. Database schema, migrations, and transactions
   4. Public API surface and input validation
   5. Configuration, secrets, deployment, and CI
   6. UI components and pages
   7. Everything else
5. For large repositories, read every file in tiers 1–3 and a representative sample of the rest. Track what you sampled. If the agent supports sub-agents, you may run one per dimension in parallel and merge their findings.

## Phase 2: Detect Tech Stack & Versions

Read the manifests to find exact versions. Do not ask the user.

| Ecosystem | Manifests | Fields |
| :--- | :--- | :--- |
| **Node.js / TS** | `package.json`, lockfile, `.nvmrc`, `.node-version` | `engines.node`, framework versions (React, Next.js, Express, NestJS, Vue, Angular, Vite), `typescript`, ORM (Prisma, TypeORM, Drizzle) |
| **Python** | `pyproject.toml`, `Pipfile`, `requirements*.txt`, `.python-version` | `requires-python`, FastAPI, Django, Flask, SQLAlchemy |
| **Java / JVM** | `pom.xml`, `build.gradle(.kts)` | Java version, Spring Boot, Micronaut, Quarkus |
| **Go** | `go.mod` | `go` directive, Gin, Fiber, Echo, GORM |
| **Rust** | `Cargo.toml` | `edition`, `rust-version`, Tokio, Actix, Axum |
| **.NET** | `*.csproj`, `global.json`, `Directory.Build.props` | `TargetFramework`, ASP.NET Core |
| **PHP** | `composer.json` | `require.php`, Laravel, Symfony |
| **Ruby** | `Gemfile`, `.ruby-version` | Ruby, Rails |
| **Containers / Infra** | `Dockerfile*`, `docker-compose*.yml`, `.github/workflows/*`, IaC files | Base image tags, service images (e.g. `postgres:16-alpine`), CI runtimes |

For monorepos, detect each app separately (e.g. `frontend/` and `backend/`).

Build `stackBreakdown` entries for: language, runtime, framework(s), styling, build tool/package manager, database, ORM/driver, auth library, test framework.

**End-of-life (EOL) status:** mark `isEol: true` only when you are confident from your knowledge. If you cannot verify, set `eolNote: "Unverified — based on knowledge as of <date>"`.

## Phase 3: Evaluate the Dimensions

Score each dimension using the rubric in Phase 4. Skip a dimension only if it truly does not apply (e.g. UI/UX for a headless API), and say why under Scope & Limitations.

### 1. Architecture & Structure (`ARCH`)
- Module boundaries, separation of concerns, layering (routes → services → data access)
- Coupling, circular dependencies, very large files, or "god" components/services
- Business logic in the wrong layer (e.g. in UI, route handlers, or the frontend when the backend owns it)
- Consistency with the architecture in the Project Rules
- Produce a Mermaid topology diagram of the real components and data flow

### 2. Security (`SEC`)
- Hardcoded secrets, committed `.env` files, secrets in client bundles or Docker images
- OWASP Top 10: injection (raw SQL, string-built queries), XSS (`dangerouslySetInnerHTML`, unescaped HTML), SSRF, path traversal, insecure deserialization
- Input validation at every API boundary (schema validation on body, params, and query)
- CORS, security headers, cookie flags, CSRF protection, rate limiting on login and expensive endpoints
- Error responses leaking stack traces or internal details

### 3. Authentication & Authorization (`AUTH`)
- Every non-public route has auth middleware; list any route that does not
- Roles and permissions are enforced on the **backend**, not only hidden in the UI
- **Tenant/company isolation:** every query on tenant data is scoped by the active company and cannot be overridden by a client-supplied ID without a membership check
- Session/JWT handling: expiry, rotation, signing secret strength, logout/invalidation
- Password hashing algorithm and parameters

### 4. Domain & Data Integrity (`DATA`)
Adapt to the domain. For financial, ERP, inventory, or other transactional systems, check:
- **Double-entry balance:** debits equal credits on every posted voucher/journal, enforced in the backend
- **Money and quantity math:** decimal types (`Decimal`, `numeric`), never floating point; consistent rounding rules
- **Atomic posting:** multi-table writes (ledger + stock + balances) run in one database transaction
- **Immutability:** posted records cannot be edited or deleted; corrections use reversal or adjustment flows
- **Concurrency:** stock and balance updates are safe under simultaneous requests (row locks, optimistic version checks, or atomic increments); no read-then-write races
- **Idempotency:** retrying a post/submit request cannot double-post
- **Period controls:** closed fiscal periods actually block changes
- **Audit trail:** who/when is recorded for create, approve, post, and reverse actions
- **Source of truth:** derived tables (balances, snapshots) can be rebuilt from history tables
- **Referential integrity:** foreign keys, unique constraints, and indexes match business rules
- Every rule from Phase 0 that is about data or domain behavior

### 5. Code Quality & Maintainability (`QUAL`)
- Readability, naming, function/file size, cyclomatic complexity
- Duplicated logic that should be shared
- Dead code, unused exports, commented-out blocks, stale TODOs
- Type safety: `any`, unchecked casts, `@ts-ignore`, disabled lint rules
- Consistent error handling patterns
- Hardcoded values that Project Rules say must come from settings or config

### 6. Testing & Reliability (`TEST`)
- Presence and location of unit, integration, and end-to-end tests
- Coverage of high-risk paths from Phase 1 tiers 1–2 (list untested critical paths by name)
- Test quality: real assertions vs. smoke tests, excessive mocking of the thing under test
- CI pipeline runs tests, type-check, and lint on pull requests
- Unhandled promise rejections, missing error boundaries, swallowed errors

### 7. Dependencies & Supply Chain (`DEP`)
- Outdated or EOL runtimes and frameworks
- Packages with known security issues (mark unverified unless an audit command was run)
- Unused or duplicate dependencies, heavy packages with light usage
- Lockfile present and committed; versions pinned appropriately
- License risks (GPL/AGPL in proprietary code)

### 8. Performance & Scalability (`PERF`)
- N+1 queries, missing indexes on filtered/joined columns, unbounded queries without pagination
- Blocking I/O on request paths, large synchronous loops
- Caching strategy where it matters
- Frontend: bundle size, unnecessary client components, large lists without virtualization, image optimization, layout shift (CLS)

### 9. Operations, CI/CD & Observability (`OPS`)
- Dockerfiles: multi-stage builds, non-root user, pinned base image tags, `.dockerignore`, no secrets baked in
- Environment config: `.env.example` complete, required variables validated at startup
- Health and readiness endpoints
- Structured logging with request IDs; no sensitive data in logs
- Error tracking/monitoring hooks
- Database migrations: safe to run, reversible or documented, not edited after release
- Backup and restore approach documented
- CI/CD: build, test, and deploy steps; branch protection signals

### 10. UI/UX & Accessibility (`UIUX`) — frontend projects only
Judge against the project's design system (e.g. `DESIGN.md`, token files) first, then general practice.

- **Design tokens:** colors, spacing, radius, and typography come from tokens/CSS variables; flag hardcoded hex/rgb and arbitrary values in components
- **Contrast:** WCAG 2.1 AA — 4.5:1 body text, 3:1 large text and UI icons — in **both** light and dark themes
- **Color is never the only signal** for status or errors; pair it with an icon or text
- **Theme system:** switching mechanism, no flash of the wrong theme on load
- **Typography:** consistent type scale, body line-height ≥ 1.5, relative units (`rem`), font loading (`font-display`)
- **Interaction states:** hover, active, disabled, and visible `:focus-visible` rings
- **Keyboard use:** every action reachable by keyboard; logical tab order; forms usable without a mouse
- **Forms:** visible labels, required markers, inline validation messages, submit buttons disabled while saving
- **User states:** loading, empty, error, and success states on every data screen
- **Destructive and irreversible actions** (delete, post, approve, close period) ask for clear confirmation
- **Responsive layout** and `prefers-reduced-motion` support

For **data-heavy business apps** (ERP, admin, back-office), also check:
- Numeric and amount columns right-aligned with consistent decimal places
- Number, date, and currency formats come from settings, not hardcoded
- Large tables: sticky headers, pagination or virtualization, sort/filter, readable density
- Line-item entry (vouchers, invoices) is fast with the keyboard: Tab/Enter to move between cells, add row without the mouse
- Consistent placement of action buttons and summary/total areas across similar screens
- Clear, plain-language labels that less technical staff can understand

## Phase 4: Findings, Severity & Scoring

### Finding rules
- **One finding per root cause.** If a pattern repeats across many files, create one finding and list all locations in `locations` (put the most important one in `location`).
- **Evidence required.** Each finding has a `file:line` location and a short code `evidence` snippet (≤ 3 lines, secrets masked).
- **Confidence:** `Confirmed` (seen directly), `Likely` (strong signal, one assumption), or `Needs Review` (cannot be confirmed statically). Do not report anything weaker than `Needs Review`.
- **IDs:** `<PREFIX>-NNN` using the dimension prefixes above (`ARCH`, `SEC`, `AUTH`, `DATA`, `QUAL`, `TEST`, `DEP`, `PERF`, `OPS`, `UIUX`), numbered per prefix.

### Severity
- **Critical:** exploitable now, secret exposure, cross-tenant data access, data loss or corruption, wrong financial totals, app cannot start
- **High:** broken or missing authorization, non-atomic posting, race conditions on stock/money, unhandled crashes on main flows, blocking accessibility failures
- **Medium:** technical debt with real cost, missing tests on critical paths, slow queries, missing validation on internal endpoints
- **Low:** style inconsistencies, minor UI nits, documentation gaps

### Effort
- `Quick Win`: under 1 hour, low risk
- `Moderate`: 1–8 hours
- `Major`: more than 1 day, or needs design/migration work

For tech-debt hours, use 0.5 h for Quick Win, 4 h for Moderate, and 16 h for Major. Sum all findings to get `techDebtHours`.

### Scoring rubric (repeatable)
- Each dimension starts at **100** and loses points per finding: **Critical −25, High −10, Medium −4, Low −1**. Apply ×0.5 for `Needs Review` findings. Floor at 0.
- **Overall score** = weighted average of dimension scores. Default weights: Security 15, Auth 15, Domain & Data Integrity 15, Architecture 10, Testing 10, Code Quality 10, Performance 8, Operations 7, Dependencies 5, UI/UX 5. When a dimension is skipped, spread its weight evenly across the others. State the weights in the report.
- **Grade:** A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60. Any open Critical finding caps the grade at C.

### Strengths
Record 3–8 things the codebase does well (with file references). These appear in the report and stop good patterns from being flagged by mistake later.

## Phase 5: Remediation Waves

Assign every finding to one wave and fill `blockedBy` with the IDs that must be fixed first.

- **Wave 0 — Emergency Containment:** exposed secrets (rotate + remove), cross-tenant leaks, data corruption risks, critical exploits, broken main flows.
- **Wave 1 — Foundations:** authentication/authorization gaps, transaction and integrity fixes, input validation, environment and config isolation. These come before refactors.
- **Wave 2 — UI/UX, Accessibility & Performance:** contrast, keyboard use, form states, design-token adoption, query and bundle performance.
- **Wave 3 — Reliability, Tests & Technical Debt:** test suites for critical paths, CI gates, dead code, duplication, dependency upgrades, operations improvements.

Within each wave, order by severity, then by `blockedBy` dependencies, then Quick Wins first.

## Phase 6: Compare with the Previous Audit (if one exists)

Match findings by ID and location/description. Record in `comparison`:
- `previousDate`, `previousScore`, score change per dimension
- `resolved`: IDs from the last audit no longer present
- `new`: IDs not present last time
- `persisting`: IDs still open

Keep IDs stable across runs where the same issue persists.

## Phase 7: Write the Outputs

Write all files to `audit/` at the workspace root.

### 1. `audit/audit-data.json` — source of truth
The full data object below. Also save a dated copy, `audit/history/audit-data-YYYY-MM-DD.json`, for comparisons later.

```jsonc
{
  "projectName": "string",
  "date": "YYYY-MM-DD",               // the audit date, a fixed string (comments here are for reference only — never include them in output)
  "commit": "short git SHA",
  "overallScore": 0,
  "grade": "A|B|C|D|F",
  "techDebtHours": 0,
  "weights": { "Security": 15, "...": 0 },
  "stackBreakdown": [
    { "component": "Runtime", "name": "Node.js", "version": "20.11.0", "isEol": false, "eolNote": "" }
  ],
  "dimensions": {
    "labels": ["Architecture", "Security", "Auth", "Data Integrity", "Quality", "Testing", "Dependencies", "Performance", "Operations", "UI/UX"],
    "scores": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  "uiUxBreakdown": { "labels": ["Accessibility", "Responsive Layout", "Design Tokens", "State Handling", "Keyboard & Forms"], "scores": [0, 0, 0, 0, 0] },
  "palette": [{ "label": "", "hex": "#000000", "textOnColor": "#ffffff", "contrast": "4.5:1", "pass": true }],
  "typographyAndTheme": { "fontFamily": "", "typeScale": "", "bodyLineHeight": "", "relativeUnits": "", "darkModeTokens": "", "touchTargetCompliance": "", "gridRhythm": "" },
  "architectureMermaid": "graph TD ...",
  "severityCounts": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "projectRules": [{ "id": "PR-01", "text": "", "source": "CLAUDE.md" }],
  "strengths": [{ "title": "", "location": "file:line" }],
  "scope": { "audited": ["path/area"], "sampled": ["path/area"], "skipped": ["path/area — reason"], "commandsRun": ["npm run type-check — 0 errors"] },
  "comparison": { "previousDate": null, "previousScore": null, "resolved": [], "new": [], "persisting": [] },
  "findings": [
    {
      "id": "SEC-001",
      "wave": "Wave 0",                  // exactly "Wave 0".."Wave 3"
      "severity": "critical",            // critical | high | medium | low (lowercase)
      "category": "Security",
      "confidence": "Confirmed",         // Confirmed | Likely | Needs Review
      "description": "What is wrong and why it matters",
      "location": "path/file.ts:14",
      "locations": ["path/file.ts:14", "path/other.ts:9"],
      "evidence": "short snippet, secrets masked",
      "ruleRef": "PR-03",                // or null
      "effort": "Quick Win",             // Quick Win | Moderate | Major
      "blockedBy": [],
      "recommendation": "Concrete fix",
      "fixPrompt": "Self-contained prompt a coding agent can run"
    }
  ]
}
```

### 2. `audit/audit-report.html` — interactive dashboard
- Read the template at [resources/audit-template.html](./resources/audit-template.html).
- Replace the **entire** contents of `<script type="application/json" id="audit-data">` with the contents of `audit/audit-data.json`. Remove all sample data — no example findings may remain.
- The block must be **valid JSON**: no comments, no trailing commas, newlines in strings written as `\n`.
- Replace every `</` in the JSON with `<\/` so the data cannot close the script tag early. Do **not** HTML-escape anything else; the template escapes all text when it renders.
- The template adapts to the data: it hides the UI/UX section when `uiUxBreakdown`, `palette`, and `typographyAndTheme` are absent; hides the diagram when `architectureMermaid` is empty; shows "First Audit" when `comparison.previousScore` is null; and marks findings listed in `comparison.new` as New.

### 3. `audit/REMEDIATION_PLAN.md` — action plan
Structure:
1. **Executive Summary:** overall score and grade, counts by severity and by wave, top 5 risks in one line each, tech-debt hours, change since the last audit.
2. **Scope & Limitations:** what was audited, sampled, and skipped; commands run; unverified items.
3. **Project Rules Checked:** the `PR-xx` list.
4. **Strengths.**
5. **Waves 0–3**, each finding as:

```markdown
### [SEC-001] Title (Critical | Security | Quick Win | Confirmed)
- **Location**: `path/file.ts:14` (+ other locations)
- **Evidence**: short snippet (secrets masked)
- **Breaks Rule**: PR-03 (if any)
- **Blocked By**: none / IDs
- **Fix**: concrete code change instructions
- **Verify**: command or manual check that proves the fix
- **Agent Prompt**:
  > Self-contained prompt for a coding agent
```

## Phase 8: Report to the User

Reply with a short summary:
- Overall score, grade, and change since the last audit
- Counts by severity and by wave
- The top 3–5 risks, each with its ID and location
- Anything skipped or unverified
- Links to the outputs using workspace-relative paths: [audit/audit-report.html](audit/audit-report.html), [audit/REMEDIATION_PLAN.md](audit/REMEDIATION_PLAN.md), [audit/audit-data.json](audit/audit-data.json)
