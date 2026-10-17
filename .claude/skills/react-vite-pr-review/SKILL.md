---
name: react-vite-pr-review
description: Use this skill to review pull request code for React applications built with Vite. Trigger for PR reviews, code reviews, merge reviews, or risk checks involving React, Vite, TypeScript, frontend API calls, forms, routing, UI components, styling, accessibility, tests, or build changes.
---

# React Vite PR Review

Review the pull request as a senior frontend reviewer. Prioritize real bugs, regressions, security risks, accessibility issues, data-loss risks, broken user flows, missing validation, and missing tests. Keep style preferences secondary unless they hide a maintainability or correctness problem.

## First Steps

1. Read repository guidance before reviewing:
   - `AGENTS.md` when present.
   - `CLAUDE.md` when present.
   - Project documents named by those files.
2. Identify the PR scope:
   - Prefer PR metadata when available.
   - Otherwise inspect `git status`, `git diff --stat`, and the diff against the likely base branch.
3. Read the changed files and nearby code, not only the diff, when behavior depends on surrounding state, hooks, shared helpers, or API contracts.
4. Find line numbers from the changed files before reporting issues.

## React And Vite Review Checks

Check for:

- Broken rendering paths, missing returns, invalid JSX, unstable keys, hydration-sensitive code, and components that crash on empty or loading data.
- Hook dependency mistakes, stale closures, state updates after unmount, repeated fetch loops, and derived state that can drift from source data.
- Form gaps such as missing required checks, wrong numeric parsing, no submit lock, unclear error display, or client validation that disagrees with backend expectations.
- API call issues: wrong endpoint, method, headers, request payload, response mapping, pagination, sorting, filtering, auth handling, timeout behavior, or user-facing error handling.
- Vite-specific issues: incorrect `import.meta.env` use, leaking non-public secrets, missing `VITE_` prefix for browser env vars, broken asset paths, bad base path assumptions, and build-only failures hidden in dev.
- TypeScript issues hidden by `any`, unsafe casts, nullable values, mismatched API DTOs, and missing discriminated handling for status values.
- Accessibility issues: unlabeled controls, keyboard traps, focus loss, color-only status, weak contrast, and buttons or icons without accessible names.
- UI regressions: layout overflow on small screens, unreadable tables, text clipped inside controls, inconsistent loading/empty/error states, and actions that fail silently.
- Performance issues: expensive work during render, repeated filtering of large lists in the browser, missing memoization where it matters, oversized bundles, and unnecessary network calls.
- Test gaps where changed logic is risky: validation, API mapping, state workflows, permission branches, routing, and error paths.

## ERP Project Checks

When reviewing this ERP repository, also check:

- Follow `documents/PROJECT_RULES.md`, `documents/CODING_STANDARDS.md`, and `documents/FRONTEND_BEST_PRACTICES.md`.
- Use simple business words and Title Case for user-facing labels.
- Use shared settings and helpers for date, number, currency, and locale formatting. Do not hard-code currency text.
- Use shared form controls and helpers instead of repeating raw input, validation, or formatting logic.
- Keep page files as orchestrators; move sections, hooks, validation, payload mapping, API clients, and print/report logic into focused files.
- Send frontend API calls through `src/lib/api`.
- Keep transaction screens consistent with the Purchase module pattern when applicable.
- Ensure posted transaction flows remain read-only and correction-oriented when accounting or inventory impact exists.

## Useful Commands

Use commands that exist in the project. Prefer reading `package.json` before running them.

Common React Vite checks:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

If a command is missing, do not treat that as a failure by itself. Report the unavailable check.

## Review Output

Return findings first, ordered by severity. Use this format:

```markdown
**Findings**
- High: `path/to/file.tsx:42` Clear description of the bug, why it matters, and the scenario that triggers it.
- Medium: `path/to/file.ts:87` Clear description...

**Open Questions**
- Question, if any.

**Checks Run**
- `npm run type-check` passed.
- `npm run build` failed: short reason.
```

If there are no findings, say that clearly and mention any checks that were not run. Keep summaries brief and secondary to the review findings.
