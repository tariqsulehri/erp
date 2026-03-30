# ERP Financial Module

A professional-grade, multi-company ERP Financial Module built with Next.js, TypeScript, and PostgreSQL.

## Quick Start

### Prerequisites
- Node.js 22 LTS
- Docker & Docker Compose
- npm 10+

### Installation

1. **Clone and setup:**
```bash
cd /path/to/ERP
npm install
```

2. **Start databases:**
```bash
docker-compose up -d
```

3. **Environment configuration:**
```bash
cp .env.example .env.local
# Edit .env.local with your settings
```

4. **Initialize database:**
```bash
npm run db:migrate
npm run db:seed
```

5. **Start development server:**
```bash
npm run dev
```

Visit `http://localhost:3000` and log in with:
- Email: `admin@example.com`
- Password: `admin123`

## Architecture

### Directory Structure

```
src/
├── app/              # Next.js App Router (thin presentation layer)
├── modules/          # Business logic (fat domain models)
├── server/           # tRPC API layer (thin wrappers)
├── db/               # Database configuration & entities
├── lib/              # Utilities & helpers
├── components/       # React components
├── types/            # TypeScript type definitions
└── worker/           # BullMQ background jobs
```

### Key Principles

1. **Thin App, Fat Modules**: Business logic lives in `/modules`, isolated from Next.js
2. **Money Math**: All financial calculations use `Decimal.js`, never floats
3. **Multi-Company**: Every table has `company_id`, filtering is automatic at repository level
4. **Type Safety**: Full TypeScript + tRPC for end-to-end type safety
5. **Audit Trail**: All mutations are immutable, versioned in the database

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Framework | Next.js 15 LTS |
| Language | TypeScript 5.8+ |
| API | tRPC 11 |
| Database | PostgreSQL 16 |
| ORM | TypeORM |
| Cache | Redis 7 |
| Auth | Auth.js v5 |
| Workers | BullMQ |
| UI | Ant Design 5.17+ |
| Money Math | Decimal.js |

## Development

### Available Scripts

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run type-check       # Check TypeScript
npm run test             # Run Jest tests
npm run test:watch       # Watch mode
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run worker:dev       # Start BullMQ worker
npm run docker:up        # Start Docker containers
npm run docker:down      # Stop Docker containers
```

### Database

#### Migrations
```bash
# Run pending migrations
npm run db:migrate

# Generate a new migration
npm run db:migrate:generate --name=AddNewTable

# Revert last migration
npm run db:migrate:revert
```

#### Seeds
```bash
# Seed initial data (COA templates, roles, etc.)
npm run db:seed
```

### Testing

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Project Structure

### Phase 1: Financial Core (Current)

- ✅ Project initialization
- ✅ Database setup
- ✅ Authentication
- ⏳ Chart of Accounts (COA)
- ⏳ General Ledger & Journal
- ⏳ Vouchers (CPV, CRV, JV, BPV, BRV)
- ⏳ Bank Module
- ⏳ Accounts Payable & Receivable
- ⏳ Financial Reports

### Phase 2: Inventory (Coming Q3 2026)

- Item Master & Warehouses
- Purchase Flow (PO → GRN → PINV)
- Sales Flow (SO → DN → SINV)
- Inventory Costing (FIFO, AVCO, Standard)
- Inventory Adjustment

### Phase 3: Advanced Features (Coming Q4 2026)

- Budget Module
- Multi-Currency Support
- Fixed Assets & Depreciation
- Cost Centre Accounting
- Custom Report Builder

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL`: PostgreSQL connection
- `REDIS_URL`: Redis connection
- `NEXTAUTH_SECRET`: Session encryption secret
- `S3_ENDPOINT`: MinIO/S3 endpoint

## Deployment

### Docker

```bash
# Build image
docker build -t erp-app .

# Build worker image
docker build -f Dockerfile.worker -t erp-worker .

# Run with docker-compose
docker-compose -f docker-compose.yml up -d
```

### Production Checklist

- [ ] Set strong `NEXTAUTH_SECRET`
- [ ] Enable SSL for database
- [ ] Configure backups
- [ ] Set up error monitoring
- [ ] Enable request logging
- [ ] Run security audit

## Contributing

1. Follow the architecture principles (thin app, fat modules)
2. Ensure TypeScript strict mode compliance
3. Use Decimal.js for all money calculations
4. Add tests for new features
5. Run `npm run format` before commit

## License

Proprietary - All rights reserved

## Support

For issues and questions, refer to the project documentation at `/ERP/CONTEXT.md`
