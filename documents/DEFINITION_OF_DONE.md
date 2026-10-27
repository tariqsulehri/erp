# Definition Of Done

A change is done only when every item that applies is true. Reviewers check this list; a pull request that skips an item says why.

## 1. It Works

- The feature does what the request or ticket asks, including the empty, loading, error, and no-permission states.
- Business rules live in the backend (`backend/src/modules/`). The frontend may repeat a rule for early feedback only if a test proves both sides agree (example: `fiscal-year-rules.ts` previews periods with the backend's rule).
- Messages use plain words a non-native English speaker understands, and say what to do next.

## 2. Accounting Stays Correct

- Every posting is balanced (debits equal credits) and goes through `insertPostedVoucher`.
- Posted vouchers and stock movements are never edited or deleted; corrections use reversal or adjustment documents.
- Inventory value in the ledger equals stock value after every stock posting.
- Posting is refused in locked or closed periods and years.
- A database test proves each of the above for the documents the change touches.

## 3. Access Is Enforced On The Backend

- Every new route uses `requirePermission` and, for branch or warehouse data, `resolveAccessScope`.
- `api-permissions.integration.test.ts` covers the new route for an allowed role and a refused role.
- Maker-checker: a user cannot approve their own voucher.

## 4. Tests

Write the tests with the code, not after it. Every bug fix starts with a test that fails without the fix.

| Change | Required tests |
|---|---|
| Backend service, rule, or calculation | Database test in `backend/test/*.integration.test.ts` on its own test company (`createTestCompany`), covering success, every validation message, and access |
| Backend pure helper | Unit test in `backend/test/*.test.ts` |
| Frontend helper or hook logic | Jest unit test in `frontend/tests/unit/` with the edge cases (empty, zero, negative, boundaries) |
| Frontend component or form | Testing Library test: renders, required-field errors, save payload, server error shown, keyboard (Enter, Escape) |
| Navigation or permissions in the menu | `frontend/tests/unit/shell/navigation.test.tsx` |
| Deployment scripts | `deployment/tests/lib.test.sh` |
| Docker image | CI builds it and runs the Prisma CLI inside it |

Coverage targets for the code a change touches (see `npm run test:coverage` in `backend/` and `frontend/`):

- Backend services and rules: at least 80% of lines and every business error message.
- Frontend helpers (`*-rules.ts`, `chart-data.ts`, formatting): at least 90% of lines.
- Shared UI components (`components/ui/`): every prop that changes behaviour.

End-to-end browser checks run before a release, when the release owner asks for them.

## 5. Interface

- Follows `DESIGN.md`: shared components from `components/ui/` (StatTile, ChartCard, ScreenHeader, SummaryCard, FormDialog), tokens from `design-tokens.css`, Poppins at the token sizes.
- Title Case labels; required fields show `*`; amounts and numbers are right-aligned and use company settings for date, currency, and number format.
- Every chart has a Table view and one value axis; every tile figure shows in full (no "…").
- Works with the keyboard, has visible focus, and every icon-only button has an accessible name.
- Works in Light and Dark themes and at 1024px wide.

## 6. Checks Pass

Run from the repository root before handing over:

```bash
cd backend  && npm run type-check && npm test
cd frontend && npm run type-check && npm run lint && npm test
deployment/tests/lib.test.sh
```

CI runs the same checks plus the frontend build and both Docker images; a red CI run is not done.

## 7. Database Changes

- Schema changes are Prisma migrations in `backend/prisma/migrations/`; never edit an applied migration.
- After adding a migration, refresh the fresh-install snapshot: `backend/scripts/db-snapshot.sh`.
- A migration that changes or removes data says in the pull request how to roll back.

## 8. Deployment

- Images are built with `deployment/build-and-push.sh` (version tag plus git commit in the image).
- Deploy with `./deploy.sh <version>` on the server; the run ends with `RESULT: SUCCESS` and every endpoint green in the status report.
- The previous version stays available as `previous` for `./rollback.sh previous`.
- No secrets in git: `.env*` files stay on the server; examples use placeholders.

## 9. Documentation

- `DESIGN.md`, `DEPLOYMENT.md`, `documents/PROJECT_RULES.md`, or `README.md` are updated when the change alters a rule, a component, a command, or a setting.
- The pull request explains what changed, why, and how it was tested.
