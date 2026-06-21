# ERP Frontend

Professional ERP frontend for the current split architecture.

The frontend is a Next.js application. It owns screens, forms, layout, validation, formatting, and API clients. It does not own database migrations, seeds, ORM entities, or backend business rules.

## Quick Start

### Prerequisites

- Node.js 24
- npm 10+
- Backend API running on port `4000`

### Environment

Create or update `frontend/.env.local`:

```bash
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:4000/api/v1
```

If the variable is not set, the frontend API client defaults to `http://localhost:4000/api/v1`.

### Install And Run

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend development server should use port `3000`.

## Architecture

```text
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # Reusable UI and module components
├── constants/        # Shared UI constants and defaults
├── hooks/            # Reusable React hooks
├── lib/              # API clients, formatting, validation, helpers
├── modules/          # Frontend module models and helpers only
└── types/            # Shared frontend TypeScript types
```

## Current Integration Pattern

- Frontend calls backend REST APIs through files in `src/lib/api/`.
- Backend owns Prisma, PostgreSQL, business rules, posting logic, and transactions.
- Frontend validates before calling the API, but backend validation remains required.
- Currency, date format, numeric format, country, and timezone should come from configurable settings.

## Available Scripts

```bash
npm run dev          # Start frontend on localhost:3000
npm run build        # Build for production
npm run start        # Start production build
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript
```

Database commands are intentionally not available in the frontend. Use the backend project for Prisma migrations, database seeds, and backend API work.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 24 |
| Framework | Next.js |
| Language | TypeScript |
| Data Fetching | TanStack Query + REST API clients |
| UI | Tailwind CSS + reusable ERP components |
| Icons | Lucide React |
| Formatting | Shared frontend formatting helpers |

## Development Rules

- Read `../AGENTS.md` and the relevant files in `../documents/` before code changes.
- Keep labels, titles, descriptions, and field names simple and easy to understand.
- Keep modules reusable and avoid putting all logic inside one component.
- Put shared formatting, validation, API, and UI behavior in reusable files.
- Keep numeric and amount fields right aligned.
- Keep voucher action buttons at the top.
- Keep line item grids dense, readable, and consistent across vouchers.

## Verification

Before handing over frontend changes, run:

```bash
npm run type-check
```

Run browser smoke tests against `http://localhost:3000` when the user has already started the frontend server.
