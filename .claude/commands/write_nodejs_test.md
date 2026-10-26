---
description: Write comprehensive tests for a requested feature, file, endpoint, module, or behavior
argument-hint: <feature, file, endpoint, module, or behavior>
allowed-tools: Bash(npm run:*), Bash(npm test:*), Bash(cat:*), Bash(rg:*), Bash(find:*), Bash(git diff:*), Bash(git status:*)
---

# Write Tests

Write comprehensive tests for: `$ARGUMENTS`

If `$ARGUMENTS` is empty, ask the user what feature, file, endpoint, module, or behavior needs tests.

## Workflow

1. Read the required project rules before changing files:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `documents/PROJECT_RULES.md`
   - `documents/CODING_STANDARDS.md`
   - For frontend tests, also read `documents/FRONTEND_BEST_PRACTICES.md`.
   - For backend tests, also read `documents/BACKEND_BEST_PRACTICES.md`.
   - For database, Prisma, inventory, stock, accounting, posting, or reporting tests, also read the related database/accounting/inventory documents named in `AGENTS.md`.
2. Discover the existing test setup before writing tests:
   - Read the relevant `package.json`.
   - Search for existing tests and test helpers.
   - Follow the existing file naming, folder location, mocking style, fixtures, and assertion patterns.
3. Identify coverage targets from `$ARGUMENTS`:
   - happy path
   - required validation
   - invalid input and clear error messages
   - permission or company-scope checks when applicable
   - empty, loading, not found, and failure states when applicable
   - edge cases for money, quantity, dates, statuses, pagination, sorting, and posting rules
4. Write focused tests with clear names and simple business language.
5. Keep tests deterministic:
   - avoid real network calls
   - avoid hidden dependency on local dates, time zones, or existing database state
   - use factories or fixtures when the repo already has them
6. Run the narrowest relevant test command first, then the broader available check:
   - targeted test file or pattern
   - package test script when present
   - `npm run type-check`
   - `npm run build` when the change affects compilation
7. Summarize:
   - tests added
   - coverage areas
   - commands run
   - any uncovered risk or missing test infrastructure

## Coverage Convention

Prefer meaningful behavior coverage over snapshot volume. For risky business logic, include tests for:

- successful result
- validation failure
- boundary values
- duplicate or race-sensitive behavior when testable
- user-safe error response
- tenant or company isolation when backend data is involved
