# ERP Platform

Multi-company ERP for accounting, inventory, purchases and sales. The repository has two apps:

- `frontend/` — Next.js user interface. Browser API calls go through its `/api/v1` proxy, which adds the signed-in user's token.
- `backend/` — Node.js, Express and Prisma API on PostgreSQL. It owns business rules, posting and the database schema.

Each app has its own `package.json`, `package-lock.json` and `Dockerfile`. Use Node.js 22 (`.nvmrc`).

## Local Development

You need Node.js 22 and PostgreSQL 16 or newer running locally.

**Backend** (http://localhost:4000):

```bash
cd backend
npm install
cp .env.example .env              # set DATABASE_URL and JWT_SECRET (openssl rand -hex 32)
npm run prisma:generate
npm run db:fresh-install          # new, empty database only; for an existing one: npm run prisma:deploy
INITIAL_ADMIN_EMAIL=you@company.com INITIAL_ADMIN_PASSWORD='a-long-password' npm run seed:admin
npm run dev
```

**Frontend** (http://localhost:3000):

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local        # set NEXTAUTH_SECRET (openssl rand -hex 32) and BACKEND_API_INTERNAL_URL
npm run dev
```

## Checks Before Handing Over

```bash
cd frontend && npm run type-check
cd backend && npm run type-check && npm test
```

Database tests run when `TEST_DATABASE_URL` points at a disposable database:

```bash
cd backend && TEST_DATABASE_URL=postgresql://user:password@localhost:5432/erp_test npm test
```

## Docker

- **Try the full stack locally:** copy `.env.docker.example` to `.env`, fill it in, then run `docker compose up -d --build`.
- **Servers:** use `deployment/` and follow [DEPLOYMENT.md](DEPLOYMENT.md). It covers install, HTTPS, updates, backups, restore and rollback.

## Project Documents

Rules and design notes live in `documents/`. Read them before changing code:

- `documents/PROJECT_RULES.md`, `documents/CODING_STANDARDS.md`
- `documents/FRONTEND_BEST_PRACTICES.md` and `DESIGN.md` (UI)
- `documents/BACKEND_BEST_PRACTICES.md`
- `documents/DATABASE_DESIGN_RULES.md`, `documents/ACCOUNTING_POSTING_RULES.md`
- `documents/INVENTORY_TABLES.md`, `documents/INVENTORY_SCHEMA.md`, `documents/BANK_DEPOSIT_SCHEMA.md`
