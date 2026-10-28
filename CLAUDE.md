# CLAUDE.md

This file gives coding-agent guidance for this repository. `AGENTS.md` and files in `documents/` are the primary rules and must be followed before code or database changes. Start with `documents/CODEBASE_GUIDE.md`, the map of the codebase.

## Project

BizTrack: a professional, multi-company ERP (purchases, sales, returns, stock and accounting) with a split architecture:

- `frontend/` is the Next.js user interface.
- `backend/` is the Node.js/Express API and owns Prisma, PostgreSQL, business rules, posting logic, and database migrations.

All seven business documents (Purchase, Purchase Return, Sale, Sale Return, Stock Transfer, Stock Adjustment, Opening Stock) share one Draft → Post → Cancel / Reverse lifecycle; see `documents/CODEBASE_GUIDE.md` section 4.

## Commands

### Frontend

```bash
cd frontend
npm run dev          # Next.js frontend on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

Do not start the frontend server unless the user asks. The user keeps it running on port `3000`.

### Backend

```bash
cd backend
npm run dev          # Backend API on localhost:4000
npm run build        # Production build
npm run type-check   # TypeScript check
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Use backend `.env` values for database connections. Do not hardcode database users, hosts, company IDs, currency symbols, fiscal years, or account ranges in feature code.

## Architecture

### Frontend

- `src/app/` contains route pages and layouts.
- `src/components/` contains reusable UI and module components.
- `src/lib/api/` contains backend REST API clients.
- `src/lib/formatting/`, `src/lib/validation/`, and shared helpers should hold reusable behavior.
- Pages and large components should compose smaller components and hooks instead of holding all logic in one file.

### Backend

- `src/routes/` exposes thin Express route handlers.
- `src/modules/` contains schemas, services, and domain logic.
- Prisma and database transactions belong in backend services or repositories.
- Posted accounting and stock transactions must be immutable; corrections should use reversal or adjustment flows.

### Database

- PostgreSQL schema changes and seeds belong in backend Prisma.
- Account codes are 10-digit numeric text using `MM GG SS PPPP`.
- Customer linked accounts use `0103010001` to `0103999999`.
- Supplier linked accounts use `0201010001` to `0201999999`.
- `inventory_stock_movements` is the inventory history source of truth.
- `inventory_stock_balances` is only a fast current-stock snapshot.
- Stock belongs to exactly one Branch (shop, sells) or one Warehouse (storage, buys): `branch_id` or `warehouse_id`. Use the helpers in `backend/src/modules/inventory/stock-holder*.ts`.
- Users work in one Branch or one Warehouse (`user_company_access`); Admin and Top Management see All Branches. Enforce access in the backend with `resolveAccessScope`.

## API Pattern

The frontend calls backend REST endpoints through focused API client files. Avoid reintroducing frontend-hosted business APIs, frontend ORM entities, or local business routers.

## Secrets

Never commit any key, token, password, connection string with a password, private key, or `.env` file to git,
in any file, even commented out or in tests and docs. Use git-ignored `.env` files and CI secrets; examples use
placeholders such as `CHANGE_ME`. The pre-commit hook (`npm run setup:hooks`) and CI enforce this with
`scripts/check-secrets.mjs` and gitleaks. Full rule: `AGENTS.md` → "No Secrets In Git".

## Design

All UI must follow documents/design/DESIGN_STANDARDS.md (fonts, themes, colour tokens, charts, layout).
No raw hex colours in components. Use the tokens only.

## UI Rules

- Every screen follows `documents/design/DESIGN_STANDARDS.md` (fonts, themes, colour tokens, charts, layout) and `DESIGN.md` (component usage). Build from the shared components listed in `frontend/src/components/COMPONENT_CATALOG.md`; see them live on `/design-system`.
- Colours: raw values only in `frontend/src/styles/themes/brand-palette.css`; components use the tokens (`npm run check:colors` enforces it). Charts take colours from `useChartTheme()`.
- Every screen, chart, and summary tile has a help button (ⓘ) with plain-words help. Text is never below 12px.
- Menu groups show their pages as tabs (`ModuleTabs`); add a page to a group in `components/shell/nav-config.ts`.
- Use Title Case labels.
- Use clear words that non-native English speakers and less technical staff can understand.
- Numeric and amount fields must be right aligned.
- Required fields must show `*`.
- Select/list controls should visually indicate that they are selectable.
- Date format, currency, timezone, country, and number formatting must come from settings.
- Voucher forms should keep action buttons at the top and use consistent line-item and summary areas.

## Verification

Run the relevant checks before handing over:

```bash
cd frontend && npm run type-check
cd backend && npm run type-check
```

For API migration work, smoke test the affected backend REST endpoints on `http://localhost:4000/api/v1`.
