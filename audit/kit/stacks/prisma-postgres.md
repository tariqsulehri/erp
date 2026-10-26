# Prisma ORM + PostgreSQL stack module

**Detection signals:** `prisma/schema.prisma`, `@prisma/client` and `prisma` in `package.json`, `prisma/migrations/`, `DATABASE_URL` with `postgresql://` or `postgres://`, `provider = "postgresql"`.

**Loads with dimensions:** data, security, performance, reliability, testing, compliance (when personal data is stored).

## Vulnerability and defect patterns

### Security
- `$queryRawUnsafe` and `$executeRawUnsafe`: string input is not parameterised; SQL injection when any part comes from a user. Also `Prisma.raw()` and `Prisma.sql` built by concatenation.
- Tagged-template `$queryRaw\`...${x}\`` is parameterised and safe; calling `$queryRaw(string)` as a normal function with a built string is not.
- Queries by id with no owner or tenant filter (`findUnique({ where: { id } })` from `req.params`): IDOR. Look for `userId`/`orgId` in `where`.
- `select`/`include` missing: full rows returned, leaking columns such as `passwordHash`, `resetToken`, `apiKey`, internal flags. Check what API responses return.
- Mass assignment: `create({ data: req.body })` or `update({ data: req.body })` lets clients set `role`, `isAdmin`, `tenantId`.
- Filters built from user input (`where: req.query`, `orderBy` from query): users can probe other fields or relations.
- Row-level security (RLS) not used on multi-tenant tables: isolation then rests only on application `where` clauses. Note it as a design question.
- Database user in `DATABASE_URL` is a superuser or owner; the app should use a least-privilege role (separate from the migration role).

### Data
- Missing `@unique`/`@@unique` for natural keys (email, external id, `(tenantId, slug)`): duplicates and race conditions. App-level "check then insert" is not enough.
- Missing `@@index` on foreign keys and on columns used in `where`/`orderBy`: Prisma does not auto-create indexes on relation scalar fields for PostgreSQL.
- Nullable fields (`String?`) that code treats as required, nullable foreign keys that should be required, optional relations with no handling of `null`.
- `onDelete: Cascade` on relations to important data (orders, audit logs): one delete removes a large tree. Check `onDelete`/`onUpdate` for each relation; the default for required relations is `Restrict`/`NoAction` behaviour, optional is `SetNull`.
- Soft delete (`deletedAt`) implemented but not applied to every query; unique constraints that ignore soft-deleted rows; `deleteMany` hard deleting by mistake.
- Money stored as `Float`; should be `Decimal` or integer minor units.
- Timestamps: `DateTime` without `@db.Timestamptz`, `@default(now())` and `@updatedAt` missing, mixed local and UTC handling.
- Enums or strings for status with no constraint; large `Json` columns holding structured data that needs queries.
- Personal data columns with no retention or deletion path (feeds compliance).

### Performance
- N+1: `findMany` then a query per row inside `for`/`map`; `include` nested several levels deep loading far more than needed; use `select`, `include` once, or batched `where: { id: { in: ids } }`.
- `findMany()` with no `take`/pagination; offset pagination (`skip`) on large tables; `count()` on every list request.
- Prisma Client created per request or per file (`new PrismaClient()` in a handler): exhausts connections. Use one shared instance (singleton, also in Next dev hot reload).
- Connection pool: small default pool (based on CPU count) and serverless or many instances can exceed Postgres `max_connections`; check `connection_limit` and use PgBouncer or Prisma Accelerate/driver adapter where relevant.
- Long interactive transactions (`$transaction(async tx => ...)`) holding connections, or external HTTP calls inside them; default timeout is 5 seconds.

### Reliability
- Multi-write operations without `$transaction`: partial updates on failure.
- Read-then-write counters or stock (`find` then `update`): lost updates; use atomic `increment`/`decrement` or `updateMany` with a condition.
- Errors not handled by code: `P2002` (unique), `P2025` (record not found), `P2003` (foreign key); raw errors leak schema details to clients.
- `upsert` on non-unique fields, or races on `upsert` without a unique constraint.
- Migration safety: see misconfigurations below.

### Testing
- Tests that run against a shared or real database; no disposable test DB or per-test cleanup.
- Tests that mock `PrismaClient` entirely, so schema, constraints and migrations are never exercised.

### Code health
- Prisma calls spread across route handlers; no repository or service boundary; duplicated `where` filters for tenant and soft delete (consider a client extension).
- Generated client committed or out of date relative to `schema.prisma`.

## Framework misconfigurations

- `prisma migrate dev` used against shared or production databases; production should use `prisma migrate deploy`.
- `prisma db push` in production or CI: skips migration history and can drop data.
- Edited or deleted already-applied migration files (checksum drift); migrations with `DROP COLUMN`, `DROP TABLE`, type changes, or `NOT NULL` added with no default on populated tables.
- No review step for generated SQL (`migration.sql`) before applying; no rollback plan (Prisma has no automatic down migrations).
- Missing `directUrl` when using a pooler (PgBouncer) for migrations.
- `DATABASE_URL` without TLS (`sslmode=require` or stricter) to a remote database; credentials in committed `.env`.
- Query logging (`log: ['query']`) enabled in production, which can write parameter values (personal data) to logs.
- Seed scripts (`prisma db seed`) with default admin passwords that can run in production.

## Scanner and project commands

All run only if approved at Checkpoint A. Never point them at a production database.
- Validate schema: `npx prisma validate` (needs `DATABASE_URL` env var present, no connection to it).
- Format check: `npx prisma format` rewrites the file; do not run it in an audit.
- Migration status: `npx prisma migrate status` (connects to the DB; use a disposable copy only).
- Dependency audit: `npm audit --json` or `osv-scanner` on the lockfile.
- Tests and coverage: the project's `test` script; check it uses a test database.
- Search aids (read-only): `rg "queryRawUnsafe|executeRawUnsafe|Prisma.raw"`, `rg "new PrismaClient"`.

## Where to look first

- Schema: `prisma/schema.prisma` (models, relations, `@unique`, `@@index`, `onDelete`).
- Migrations: `prisma/migrations/*/migration.sql`, `migration_lock.toml`.
- Client setup: `src/lib/prisma.*`, `src/db.*`, `src/config/database.*`; extensions and middleware (`$extends`, `$use`).
- Seeds: `prisma/seed.*`.
- Queries: `services/`, `repositories/`, `controllers/`; grep `prisma\.` across the repo.
- Tests: `tests/`, `docker-compose.test.yml`, `jest`/`vitest` setup files.

## Looks wrong but is fine

- `$queryRaw` and `$executeRaw` used as tagged templates with `${}` values (parameterised).
- `$queryRawUnsafe` with a fixed constant SQL string and no user input.
- No explicit index on a field that already has `@id` or `@unique` (both create indexes).
- `onDelete: Cascade` on pure child rows (for example join-table rows, tokens, drafts).
- `findUnique` by id inside admin-only, role-checked routes.
- `Json` column for genuinely schemaless payloads (webhook bodies, settings).

## Version notes

- Prisma 5 and 6 changed behaviours (for example `Json` null handling, `$queryRaw` result types, removal of some middleware APIs); check the installed major.
- `$use` middleware is deprecated in favour of client extensions (`$extends`) in recent versions.
- Driver adapters and `relationJoins` (join-based loading) are newer features; behaviour of `include` differs by version and preview flags.
- Postgres major versions reach end of life; check the server version, not only the client.
- Verify against the installed version.
