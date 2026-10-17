---
name: software-auditor
description: >-
  Audits any codebase or software solution regardless of technology or language.
  Performs multi-dimensional analysis (Architecture, Security, Code Quality, Testing, 
  Dependencies, Performance, UI/UX) and generates an interactive, color-coded HTML report 
  with visual graphs, Mermaid topology, and UI/UX element breakdowns.
---

# Universal Software Audit & Report Generator

Follow this autonomous, non-interactive workflow to inspect the target repository and generate an interactive HTML report.

## ⛔ CRITICAL EXECUTION RULES (STRICT READ-ONLY & AUTONOMOUS)
1. **ZERO-MODIFICATION POLICY**: You are auditing ONLY. **DO NOT** modify, update, reformat, or delete any source files, configs, or directories in the project. The **ONLY** file you are permitted to write is the final `audit-report.html`.
2. **ZERO COMMAND CONFIRMATIONS (USE BUILT-IN READ TOOLS)**: 
   - Prioritize built-in native read tools (`view_file`) to inspect manifests, structure, and code. These run silently without triggering user approval dialogs.
   - If shell commands are needed for discovery (e.g. `ls`, `find`), run them strictly in **Standard Sandboxed Mode** (`BypassSandbox: false`) with standard read-only flags. Never run network commands, package installs, or unsandboxed operations that prompt the user.
3. **RUN UNATTENDED TO COMPLETION**: Do not pause, do not ask the user for confirmation or interactive input. Complete all phases autonomously, compile the report, and notify the user when finished.

---

## Phase 1: Automatic Tech Stack & Version Detection
Inspect the project root using native read tools (`view_file`) to automatically detect exact runtimes, languages, and framework versions without asking the user:

| Ecosystem | Manifests to Inspect | Target Fields to Extract |
| :--- | :--- | :--- |
| **Node.js / TS** | `package.json`, `.nvmrc`, `package-lock.json` | `engines.node`, `dependencies` (React, Next.js, Express, Vue, Angular, Vite versions), `devDependencies.typescript` |
| **Python** | `pyproject.toml`, `Pipfile`, `requirements.txt`, `.python-version` | `requires-python`, `[tool.poetry.dependencies]`, FastAPI, Django, Flask, SQLAlchemy versions |
| **Java / JVM** | `pom.xml`, `build.gradle`, `build.gradle.kts` | `<java.version>`, `sourceCompatibility`, Spring Boot (`<spring.boot.version>`), Micronaut, Quarkus |
| **Go** | `go.mod` | Go directive (`go 1.xx`), Gin, Fiber, Echo, GORM versions |
| **Rust** | `Cargo.toml` | `edition`, `rust-version`, Tokio, Actix, Axum versions |
| **.NET / C#** | `*.csproj`, `global.json`, `Directory.Build.props` | `<TargetFramework>` (`net8.0`, `net7.0`), ASP.NET Core package versions |
| **PHP** | `composer.json` | `require.php`, Laravel or Symfony versions |
| **Ruby** | `Gemfile`, `.ruby-version` | `ruby` constraint, Rails version |
| **Containers** | `Dockerfile`, `docker-compose.yml` | Base image tags (e.g. `FROM python:3.11-slim`, `postgres:16-alpine`) |

Compile these into a structured `stackBreakdown` object in the audit data:
- Primary Language & Version (e.g. `TypeScript 5.3.3`)
- Runtime / Engine (e.g. `Node.js 20.x`, `Go 1.22`, `Python 3.11`)
- Core Framework & Version (e.g. `Next.js 14.1.0`, `FastAPI 0.110.0`, `Spring Boot 3.2.1`)
- Build System / Package Manager (e.g. `pnpm`, `Cargo`, `Maven`, `Gradle`, `uv`)
- Database & ORM / Driver (e.g. `PostgreSQL 16`, `Prisma 5.10`, `SQLAlchemy 2.0`)

## Phase 2: Multi-Dimensional Evaluation (Including UI/UX)
Evaluate the codebase across 7 core dimensions (Score 0–100):
1. **Architecture & Structure**: Modularity, separation of concerns, coupling, directory organization, topology diagram generation.
2. **Security & Vulnerabilities**: Hardcoded secrets/API keys, insecure dependencies, OWASP Top 10 patterns, input validation.
3. **Code Quality & Maintainability**: Readability, complexity, dead code, code duplication, adherence to idioms.
4. **Testing & Reliability**: Test coverage presence, mock usage, CI testing pipelines, error handling.
5. **Dependency & Supply Chain / EOL**: Dependency bloat, outdated libraries, licensing risks, and **End-of-Life (EOL)** calendar verification for runtime/frameworks.
6. **Performance & Scalability**: Resource leaks, unindexed queries, blocking I/O, caching strategies, bundle size.
7. **UI/UX & Accessibility (Frontend/Client Solutions)**:
   - **WCAG 2.1 Accessibility**: Alt tags, accessible form labels, screen-reader landmarks, ARIA attributes, keyboard navigation (`:focus-visible`), and color contrast ratios.
   - **Responsive & Layout Stability**: Viewport meta, Flexbox/Grid usage vs brittle fixed pixel dimensions, overflow clipping, layout shift (CLS).
   - **Design System & Token Consistency**: Reusable design tokens (CSS variables, Tailwind themes, theme palettes) vs magic numbers / raw hex colors.
   - **User State Completeness**: Loading skeletons/spinners, empty states, error boundary fallbacks, button disablement/debouncing on submit.
   - **Asset & Font Optimization**: WebP/AVIF vs uncompressed PNG/JPEG, SVG hygiene, `font-display: swap`.

## Phase 3: Severity & Remediation Effort Categorization
Assign each discovered issue a standardized Step ID, category, severity, and effort:
- **Standardized Step IDs**:
  - `SEC-001`, `SEC-002`... (Security & Vulnerabilities)
  - `UIUX-001`, `UIUX-002`... (UI/UX, Accessibility & Layout)
  - `ARCH-001`, `ARCH-002`... (Architecture & Modularity)
  - `PERF-001`, `PERF-002`... (Performance & Core Web Vitals)
  - `QUAL-001`, `QUAL-002`... (Code Quality & Maintainability)
  - `TEST-001`, `TEST-002`... (Testing & Reliability)
  - `DEP-001`, `DEP-002`... (Dependencies, Licensing & EOL)
- **Severity**:
  - **Critical** (Red `#ef4444`): Immediate exploitability, credential leaks, data loss risk, complete UI breakage.
  - **High** (Orange `#f97316`): Major design flaws, broken authentication, blocking accessibility failures, unhandled exceptions.
  - **Medium** (Yellow/Amber `#eab308`): Technical debt, missing test suites, sub-optimal queries, unoptimized assets.
  - **Low / Info** (Blue `#3b82f6`): Formatting inconsistencies, minor styling nits, documentation gaps.
- **Remediation Effort Tag**:
  - `Quick Win` (< 30 min, low risk, high impact)
  - `Moderate` (2–4 hours)
  - `Major Architectural Task` (> 1–2 days)

## Phase 4: Wave Sequencing (Remediation Plan Architecture)
Organize all findings into prioritized, dependency-ordered **Remediation Waves** (inspired by the Audit Kit methodology):
1. **Wave 0: Emergency Containment & Hotfixes (U0)**
   - Hardcoded credentials, active data leaks, critical broken client routes. Must be executed first.
2. **Wave 1: Core Architectural & Security Foundations**
   - Auth boundaries, database contracts, environment isolation, prerequisites required before UI/feature refactors.
3. **Wave 2: UI/UX, Accessibility & Core Web Vitals**
   - WCAG 2.1 AA color contrast, responsive layout fixes, accessible form labels, loading/error states, asset/font optimization.
4. **Wave 3: Reliability, Test Coverage & Technical Debt**
   - Unit/integration test suites, CI validation gates, dead code elimination, dependency EOL upgrades.

## Phase 5: Dual Delivery (HTML Dashboard + REMEDIATION_PLAN.md)
1. **Interactive HTML Report (`audit-report.html`)**:
   - Read base template at [resources/audit-template.html](./resources/audit-template.html).
   - Inject the findings data, charts, Mermaid topology, and the wave-sequenced remediation view.
   - Write to `audit-report.html` in the workspace root.
2. **Comprehensive Markdown Plan (`REMEDIATION_PLAN.md`)**:
   - Generate `REMEDIATION_PLAN.md` in the workspace root structured by Waves (Wave 0 to Wave 3).
   - For every step include:
     - `### [ID] Title (Severity | Category | Effort)`
     - **Location**: exact `file:line` citation.
     - **Prerequisites / Dependencies**: any step ID that must be completed first (`blocked_by`).
     - **Remediation Instructions**: concrete code change instructions.
     - **Verification Check**: automated command or manual assertion to prove the fix.
     - **AI Agent Prompt**: copy-paste prompt formatted for coding assistants.
3. Provide a concise executive summary to the user with the overall score, counts by wave, and clickable links to both [audit-report.html](file:///audit-report.html) and [REMEDIATION_PLAN.md](file:///REMEDIATION_PLAN.md).