# ERP Platform

This repository is split into two independent apps:

- `frontend/` - existing Next.js ERP frontend
- `backend/` - Node.js + Express + Prisma API backed by PostgreSQL

Each app owns its own `package.json`, `package-lock.json`, `node_modules`, and `Dockerfile`.

## Docker

```bash
docker compose up -d
```

Services:

- `erp_frontend` - http://localhost:3000
- `erp_backend` - http://localhost:4000
- `erp_postgres` - localhost:5432

## Local Development

Start only PostgreSQL:

```bash
docker compose up -d postgres
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

Redis is intentionally not included yet. Add it only when queues, caching, or background jobs are required.

## Project Documents

Standards and design notes live in `documents/`:

- `documents/PROJECT_RULES.md`
- `documents/CODING_STANDARDS.md`
- `documents/FRONTEND_BEST_PRACTICES.md`
- `documents/BACKEND_BEST_PRACTICES.md`
- `documents/DATABASE_DESIGN_RULES.md`
- `documents/INVENTORY_TABLES.md`
- `documents/INVENTORY_SCHEMA.md`
