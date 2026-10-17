---
description: Write comprehensive frontend tests with React Testing Library for a requested component, page, hook, form, or user flow
argument-hint: <component, page, hook, form, or user flow>
allowed-tools: Bash(npm run:*), Bash(npm test:*), Bash(cat:*), Bash(rg:*), Bash(find:*), Bash(git diff:*), Bash(git status:*)
---

# Write Frontend Tests

Write comprehensive React Testing Library tests for: `$ARGUMENTS`

If `$ARGUMENTS` is empty, ask the user what component, page, hook, form, or user flow needs frontend tests.

## Workflow

1. Read the required project rules before changing files:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `documents/PROJECT_RULES.md`
   - `documents/CODING_STANDARDS.md`
   - `documents/FRONTEND_BEST_PRACTICES.md`
2. Discover the current frontend test setup:
   - Read `frontend/package.json`.
   - Read `frontend/jest.config.js` and `frontend/jest.setup.js` when present.
   - Search for existing frontend tests and test helpers.
   - Follow the repo's naming, folder, mock, fixture, and render-provider patterns.
3. Identify the behavior from `$ARGUMENTS`:
   - rendered labels, headings, table columns, tabs, buttons, and status text
   - loading, empty, success, validation, and error states
   - user actions such as typing, selecting, filtering, saving, printing, refreshing, opening detail views, and clearing inputs
   - API calls through `src/lib/api` and related response mapping
   - date, number, currency, quantity, status, and pagination behavior
4. Write tests with React Testing Library conventions:
   - Prefer `screen.getByRole`, `getByLabelText`, `getByText`, and accessible names.
   - Use `userEvent` for user interactions when available; otherwise follow the existing project pattern.
   - Test behavior and user-visible output instead of implementation details.
   - Avoid brittle snapshots unless the repo already uses them for a clear reason.
   - Mock network/API calls, browser APIs, router hooks, and timers only where needed.
5. Cover ERP frontend rules:
   - required fields show useful validation messages before API calls
   - failed API calls show user-visible errors
   - save/process actions prevent double submit while pending
   - filters reset pagination where applicable
   - numeric and amount values are displayed through shared formatting helpers
   - posted/detail views stay read-only where applicable
6. Run the narrowest relevant command first, then broader checks:
   - targeted Jest test file or pattern
   - `npm run test -- --coverage --runInBand` when coverage is requested or the change is broad
   - `npm run type-check`
   - `npm run build` when compilation or Next.js routing is affected
7. Summarize:
   - tests added
   - user behaviors covered
   - coverage command and result when run
   - commands run
   - any remaining untested risk

## Coverage Convention

Prioritize meaningful behavior coverage. For important screens and components, include tests for:

- initial render
- successful user flow
- validation failure
- API failure
- empty data
- loading state
- disabled or read-only state
- keyboard-accessible labels and button names
