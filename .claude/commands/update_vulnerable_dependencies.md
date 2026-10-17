---
description: Update vulnerable dependencies for the Node.js backend
argument-hint: [optional package, advisory, or scope]
allowed-tools: Bash(npm audit:*), Bash(npm install:*), Bash(npm update:*), Bash(npm run:*), Bash(cat:*), Bash(rg:*), Bash(git diff:*), Bash(git status:*)
---

# Update Vulnerable Backend Dependencies

Update vulnerable dependencies for the Node.js backend. Optional focus: `$ARGUMENTS`.

## Workflow

1. Read the required project rules before changing files:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `documents/PROJECT_RULES.md`
   - `documents/CODING_STANDARDS.md`
   - `documents/BACKEND_BEST_PRACTICES.md`
2. Inspect backend dependency files:
   - `backend/package.json`
   - `backend/package-lock.json` when present
3. Run the backend audit from `backend/`:
   - `npm audit`
   - Use `$ARGUMENTS` as the focus if it names a package, advisory, or scope.
4. Prefer safe fixes first:
   - Use `npm audit fix` for compatible patch/minor security fixes.
   - Use targeted `npm install package@version` when a specific package must be updated.
   - Do not use `npm audit fix --force` unless the user explicitly approves the breaking-change risk.
5. Re-run `npm audit` after changes and confirm the remaining status.
6. Validate the backend:
   - `npm run type-check`
   - `npm run build`
   - Run tests if the backend has a test script.
7. Review the diff and summarize:
   - changed packages
   - vulnerability classes fixed
   - any remaining advisories and why they remain
   - validation commands and results

## Rules

- Keep changes scoped to backend dependency files unless a code change is required by an updated package.
- Do not edit frontend dependencies for this command.
- Do not remove packages unless the audit fix or package usage review proves they are unused and unsafe.
- Do not hide failed checks. Report exact commands and short failure reasons.
