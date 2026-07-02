# CLAUDE.md

This file gives coding-agent guidance for this repository. `AGENTS.md` and files in `documents/` are the primary rules and must be followed before code or database changes.

## Project

Professional, multi-company ERP system with a split architecture:

- `frontend/` is the Next.js user interface.
- `backend/` is the Node.js/Express API and owns Prisma, PostgreSQL, business rules, posting logic, and database migrations.

The current work focuses on financial vouchers, chart of accounts, customers, suppliers, inventory, purchases, and backend API migration.

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

## API Pattern

The frontend calls backend REST endpoints through focused API client files. Avoid reintroducing frontend-hosted business APIs, frontend ORM entities, or local business routers.

## UI Rules

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
