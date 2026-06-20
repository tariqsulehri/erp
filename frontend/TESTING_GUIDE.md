# Testing Guide — Phase 1: Chart of Accounts + Fiscal Year

Complete step-by-step guide to test the Chart of Accounts and Fiscal Year modules locally.

---

## ✅ Prerequisites

Before testing, ensure you have:

```bash
# Node.js 22 LTS
node --version
# Should output: v22.x.x

# npm 10+
npm --version
# Should output: 10.x.x or higher

# Docker & Docker Compose
docker --version
docker-compose --version
```

If missing, install from:
- Node.js: https://nodejs.org/
- Docker: https://www.docker.com/

---

## 🚀 Phase 1: Initial Setup

### Step 1.1: Install Dependencies

```bash
cd /Users/tk-lpt-1088/development/react/erp/ERP

# Install all npm packages (next, typeorm, trpc, auth.js, etc.)
npm install

# Should complete without errors (may take 2-3 minutes)
# Expected: "added X packages"
```

**Troubleshooting:**
- If error: `npm ERR! code ERESOLVE`, run: `npm install --legacy-peer-deps`
- If error: `node version`, ensure Node 22 LTS: `nvm use 22`

### Step 1.2: Start Local Services (PostgreSQL, Redis, MinIO)

```bash
# Start Docker containers in background
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Expected output:
# NAME              STATUS
# erp_postgres      Up (healthy)
# erp_redis         Up (healthy)
# erp_minio         Up (healthy)
```

**Troubleshooting:**
- If containers not healthy after 30 seconds, check logs: `docker-compose logs postgres`
- If port 5432 already in use: `lsof -i :5432` and kill the process
- If connection refused: Wait 10 seconds for Postgres to initialize

### Step 1.3: Verify Database Connection

```bash
# Connect to PostgreSQL directly
psql postgresql://postgres:@localhost:5432/erp_financial_db

# You should see the PostgreSQL prompt:
# erp_financial_db=>

# Test connection
SELECT version();

# Should return PostgreSQL version

# Exit
\q
```

**Troubleshooting:**
- If command not found: Install PostgreSQL client: `brew install postgresql`
- If connection refused: Check Docker logs: `docker-compose logs postgres`

### Step 1.4: Configure Environment Variables

```bash
# Create .env.local from template
cp .env.example .env.local

# Verify .env.local contents (should match docker-compose.yml)
cat .env.local

# Key variables should be:
# DATABASE_URL=postgresql://postgres:@localhost:5432/erp_financial_db
# REDIS_URL=redis://localhost:6379/0
# NEXTAUTH_SECRET=test-secret-key-for-testing
```

---

## 🗄️ Phase 2: Database Setup

### Step 2.1: Run Database Migrations

Migrations create the `accounts`, `fiscal_years`, and `fiscal_periods` tables.

```bash
# Run all pending migrations
npm run db:migrate

# Expected output:
# Migration CreateAccountsTables1000000000000 has been executed successfully.
# Migration CreateFiscalYearTables1000000000001 has been executed successfully.

# Verify migrations ran
psql postgresql://postgres:@localhost:5432/erp_financial_db

# List all tables
\dt

# Expected tables:
# account_categories
# accounts
# coa_templates
# fiscal_years
# fiscal_periods
# companies (from earlier setup)

# Exit
\q
```

**Troubleshooting:**
- If error: `relation "accounts" does not exist`, migrations didn't run properly
- If error: `permission denied`, check user permissions
- If error: `failed to initialize database`, check DATABASE_URL in .env.local

### Step 2.2: Seed Database with COA Templates

Seeds populate account categories and COA templates (Trading, Manufacturing, Services).

```bash
# Run seed script
npm run db:seed

# Expected output:
# 🌱 Starting database seed...
# Initializing database connection...
# ✓ Database connected
# 1. Seeding Chart of Accounts templates and categories...
# ✓ Category 1 — Assets created
# ✓ Category 2 — Liabilities created
# ... (more categories)
# ✓ Seeded template: TRADING
# ✓ Seeded template: MANUFACTURING
# ✓ Seeded template: SERVICES
# ✓ All seeds completed successfully!

# Verify data was seeded
psql postgresql://postgres:@localhost:5432/erp_financial_db

# Check account categories
SELECT * FROM account_categories ORDER BY category_code;

# Expected: 8 rows (1-9 categories)
# 1 | Assets | Debit
# 2 | Liabilities | Credit
# ... (more categories)

# Check COA templates
SELECT template_code, template_name, account_count FROM coa_templates;

# Expected: 3 rows
# TRADING | Standard Trading COA | 50
# MANUFACTURING | Manufacturing COA | 55
# SERVICES | Services COA | 48

# Exit
\q
```

**Troubleshooting:**
- If error: `no such file`, check file exists: `ls src/db/seeds/`
- If error: `migration not found`, re-run: `npm run db:migrate`
- If seed times out, check PostgreSQL is running: `docker-compose logs postgres`

### Step 2.3: Verify Schema & Data

```bash
# Check accounts table structure
psql postgresql://postgres:@localhost:5432/erp_financial_db

# Describe accounts table
\d accounts

# Expected columns:
# id (uuid) — Primary key
# company_id (uuid) — For multi-company
# code (varchar 8) — 8-digit account code
# name (varchar 100)
# account_type (varchar 50)
# normal_balance (varchar 10)
# is_posting (boolean)
# is_system (boolean)
# is_active (boolean)
# created_at, updated_at (timestamps)
# ... (more audit fields)

# Check fiscal_years table structure
\d fiscal_years

# Expected columns:
# id (uuid)
# company_id (uuid)
# fiscal_year (varchar 50)
# start_date, end_date (date)
# number_of_periods (int)
# status (varchar 20)
# is_active (boolean)
# is_locked (boolean)
# ... (more fields)

# Check fiscal_periods table structure
\d fiscal_periods

# Expected columns:
# id (uuid)
# fiscal_year_id (uuid) — FK to fiscal_years
# period_number (int)
# period_name (varchar 100)
# start_date, end_date (date)
# is_open (boolean)
# is_locked (boolean)
# ... (more fields)

# Exit
\q
```

---

## 🚀 Phase 3: Start Development Server

### Step 3.1: Launch Next.js Dev Server

```bash
# Start development server
npm run dev

# Expected output:
# ▲ Next.js 15.0.0
# - Local: http://localhost:3000
#
# ✓ Ready in 3.2s

# Keep this running in a terminal window
```

### Step 3.2: Access the Application

```bash
# Open in browser
open http://localhost:3000

# You should see:
# - Login page (if not authenticated)
# - Email: admin@example.com
# - Password: admin123
# - "Sign In" button
```

**Troubleshooting:**
- If error: `Port 3000 already in use`, kill process: `lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill`
- If blank page, check console for errors: F12 → Console tab
- If error: `DATABASE_URL not set`, verify .env.local exists

---

## 🔐 Phase 4: Test Authentication

### Step 4.1: Login

1. Open http://localhost:3000 in browser
2. You should see login page
3. Enter credentials:
   - **Email**: `admin@example.com`
   - **Password**: `admin123`
4. Click "Sign In"

**Expected Result:**
- Redirected to dashboard
- See sidebar with navigation
- Welcome message: "Welcome back, Admin User"
- Role displayed: "Role: admin"

**Troubleshooting:**
- If error: `invalid credentials`, check .env.local has NEXTAUTH_SECRET set
- If page blank, check browser console (F12)
- If stuck on login, check server logs for errors

### Step 4.2: Verify Session

```bash
# Check browser DevTools
# F12 → Application → Cookies → localhost:3000

# Should see:
# next-auth.session-token (or auth.sessionToken depending on version)
```

---

## 📊 Phase 5: Test tRPC API Endpoints

### Step 5.1: Use REST Client (VS Code Extension)

Install REST Client extension in VS Code:
- Open Extensions (Ctrl+Shift+X / Cmd+Shift+X)
- Search: "REST Client"
- Click "Install" by Huachao Mao

### Step 5.2: Create Test File

Create file: `API_TESTS.http`

```http
### Get Active Fiscal Year
GET http://localhost:3000/api/trpc/fiscalYear.getActive

### Get All Accounts
GET http://localhost:3000/api/trpc/accounts.list?input={"page":1,"limit":20}

### Health Check
GET http://localhost:3000/api/trpc/health.ping

### Validate Posting Date
GET http://localhost:3000/api/trpc/fiscalYear.validatePostingDate?input={"date":"2025-03-15"}

### Create Fiscal Year
POST http://localhost:3000/api/trpc/fiscalYear.create
Content-Type: application/json

{
  "fiscal_year": "2025",
  "year_basis": "calendar",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "number_of_periods": 12,
  "posting_cutoff_days": 5
}
```

### Step 5.3: Run Tests

1. Open `API_TESTS.http` in VS Code
2. Click "Send Request" above each request
3. Results appear in "Response" tab

**Expected Responses:**

```
Health Check:
✓ { "message": "ERP Financial Module API is running", "version": "0.1.0" }

Get Active Fiscal Year:
⚠️ Error: "No active fiscal year. Please create one first."
   (This is expected - no FY created yet)

Get All Accounts:
⚠️ Error: "Unauthorized" or similar
   (Because we haven't created a company with accounts)
```

**Troubleshooting:**
- If error: `Cannot GET /api/trpc/...`, ensure dev server is running
- If error: `401 Unauthorized`, need to authenticate (requires session setup)
- If error: `CORS error`, check NEXTAUTH_URL in .env.local

---

## 🧪 Phase 6: Manual API Testing

### Step 6.1: Test via Browser Console

```bash
# Open DevTools in browser
F12

# Go to Console tab

# Test tRPC client (after authentication)
# This requires setting up the tRPC client, which requires UI integration

# For now, test via curl instead
```

### Step 6.2: Test via cURL

Open terminal and run:

```bash
# Health check (no authentication needed)
curl -X GET http://localhost:3000/api/trpc/health.ping

# Expected output:
# {"result":{"data":{"message":"ERP Financial Module API is running","timestamp":"2025-03-28T10:30:00Z","version":"0.1.0"}}}

# Create Fiscal Year (requires authentication)
# For authenticated requests, we'd need to get session token first
# For now, this demonstrates the endpoint structure
```

---

## 🧬 Phase 7: Database Testing

### Step 7.1: Test Account Creation (Direct SQL)

```bash
# Connect to database
psql postgresql://postgres:@localhost:5432/erp_financial_db

# Create test company first
INSERT INTO companies (id, group_id, name, currency_code, is_active)
VALUES (
  'test-company-uuid',
  'test-group-uuid',
  'Test Trading Company',
  'USD',
  true
);

# Create test account
INSERT INTO accounts (
  id,
  company_id,
  code,
  name,
  account_type,
  normal_balance,
  is_posting,
  is_system,
  is_active
) VALUES (
  'test-account-uuid',
  'test-company-uuid',
  '10100001',
  'Petty Cash',
  'Asset',
  'Debit',
  true,
  false,
  true
);

# Verify account was created
SELECT code, name, account_type, is_posting FROM accounts
WHERE company_id = 'test-company-uuid';

# Expected output:
# code    | name        | account_type | is_posting
# 10100001 | Petty Cash | Asset        | t

# Exit
\q
```

### Step 7.2: Test Fiscal Year Creation (Direct SQL)

```bash
# Connect to database
psql postgresql://postgres:@localhost:5432/erp_financial_db

# Create fiscal year
INSERT INTO fiscal_years (
  id,
  company_id,
  fiscal_year,
  year_basis,
  start_date,
  end_date,
  number_of_periods,
  period_type,
  status,
  is_active
) VALUES (
  'test-fy-uuid',
  'test-company-uuid',
  '2025',
  'calendar',
  '2025-01-01',
  '2025-12-31',
  12,
  'monthly',
  'open',
  true
);

# Create periods manually (or would be auto-created by service)
INSERT INTO fiscal_periods (
  id,
  company_id,
  fiscal_year_id,
  period_number,
  period_name,
  start_date,
  end_date,
  status,
  is_open,
  posting_cutoff_days
) VALUES (
  'test-period-1-uuid',
  'test-company-uuid',
  'test-fy-uuid',
  1,
  'January 2025',
  '2025-01-01',
  '2025-01-31',
  'open',
  true,
  5
);

# Verify fiscal year created
SELECT fiscal_year, status, is_active FROM fiscal_years
WHERE company_id = 'test-company-uuid';

# Expected output:
# fiscal_year | status | is_active
# 2025        | open   | t

# Verify periods created
SELECT period_name, status, is_open FROM fiscal_periods
WHERE fiscal_year_id = 'test-fy-uuid';

# Expected output:
# period_name  | status | is_open
# January 2025 | open   | t

# Exit
\q
```

---

## 📈 Phase 8: Unit Testing (Optional)

### Step 8.1: Run Jest Tests

```bash
# Run all tests
npm run test

# Expected output:
# PASS  tests/unit/...
# PASS  tests/integration/...
#
# Tests: X passed, Y failed
# Snapshots: 0 total
```

**Note:** Tests need to be written first. See Phase 9.

### Step 8.2: Watch Mode (For Development)

```bash
# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run coverage report
npm run test:coverage
```

---

## 🔍 Phase 9: Browser DevTools Inspection

### Step 9.1: Network Tab

1. Open browser DevTools: **F12**
2. Go to **Network** tab
3. Make API calls (login, navigate to pages)
4. Observe requests/responses:
   - **POST /api/auth/signin** → Creates session
   - **GET /api/trpc/...** → API calls

### Step 9.2: Application Tab

1. Go to **Application** tab
2. Check **Cookies** → Should see authentication token
3. Check **Local Storage** → Session data
4. Check **Session Storage** → Temporary data

### Step 9.3: Console Errors

1. Go to **Console** tab
2. Look for red errors (should be none)
3. Yellow warnings are usually safe

---

## 🧾 Phase 10: Checklist — What to Verify

### Database ✓
- [ ] PostgreSQL container running (`docker-compose ps`)
- [ ] Database created (`psql ... -l`)
- [ ] Migrations applied (`\dt` shows all tables)
- [ ] Seeds populated (account_categories has 8 rows)
- [ ] COA templates created (coa_templates has 3 rows)
- [ ] Indexes created (`\di` shows indexes)

### API Server ✓
- [ ] Dev server running (`npm run dev`)
- [ ] Can connect to localhost:3000
- [ ] No TypeScript errors in console
- [ ] Health check returns 200 OK

### Authentication ✓
- [ ] Can login with admin@example.com / admin123
- [ ] Session token created (see cookies)
- [ ] Redirected to dashboard after login
- [ ] User role displayed correctly

### Data Access ✓
- [ ] Can query fiscal years via tRPC
- [ ] Can query accounts via tRPC
- [ ] Validation works (posting date check)
- [ ] No console errors in browser

### Database Integrity ✓
- [ ] Company data isolated (company_id in every table)
- [ ] Account hierarchy working (parent codes calculated)
- [ ] Period dates valid (start < end)
- [ ] Foreign keys intact (fiscal_year_id → fiscal_years)

---

## 🐛 Troubleshooting Guide

### Problem: "Port 5432 already in use"
```bash
# Find process using port
lsof -i :5432

# Kill process
kill -9 <PID>

# Or change docker-compose port mapping
# Edit docker-compose.yml: 5432:5432 → 5433:5432
```

### Problem: "Cannot connect to database"
```bash
# Check container logs
docker-compose logs postgres

# Restart containers
docker-compose restart

# Or full reset
docker-compose down -v
docker-compose up -d
```

### Problem: "TypeScript errors in console"
```bash
# Run type check
npm run type-check

# Fix errors indicated in output

# Rebuild
npm run build
```

### Problem: "No active fiscal year" error
```bash
# This is expected!
# You must create a fiscal year first (in next phase)
# This error means the system is working correctly
```

### Problem: "Accounts table is empty"
```bash
# Check if seed ran
psql postgresql://postgres:@localhost:5432/erp_financial_db
SELECT COUNT(*) FROM coa_templates;

# If 0, re-run seed
npm run db:seed

# If still 0, check for errors in seed output
```

---

## 📋 Testing Summary

| Component | Test Method | Status |
|-----------|-----------|--------|
| Database | psql, Docker | ✓ Manual |
| Migrations | TypeORM | ✓ Manual |
| Seeds | npm run db:seed | ✓ Manual |
| API (tRPC) | REST Client / cURL | ✓ Manual |
| Auth | Browser login | ✓ Manual |
| UI | Browser navigation | ⏳ TBD (need pages) |
| Unit Tests | Jest | ⏳ TBD (need tests) |
| E2E Tests | Playwright | ⏳ TBD (need specs) |

---

## 🎯 Next Steps After Testing

Once all tests pass ✓:

1. **Write Unit Tests** for business logic
   - Account service (validation, hierarchy)
   - Fiscal year service (period generation, validation)

2. **Write Integration Tests** for database operations
   - Repository queries (company scoping)
   - Foreign key constraints

3. **Write E2E Tests** with Playwright
   - Login flow
   - Create fiscal year
   - Create account

4. **Build React UI** for:
   - Account listing, creation, editing
   - Fiscal year listing, creation, locking
   - Period management (lock, close)

---

## 📞 Support

If tests fail:
1. Check error message carefully
2. Review logs: `docker-compose logs`
3. Verify .env.local has all required variables
4. Ensure PostgreSQL/Redis/MinIO are running
5. Check ports: `lsof -i :3000`, `lsof -i :5432`, `lsof -i :6379`

---

**Last Updated**: March 2026
**Test Coverage**: Database + API + Auth
**Status**: Ready for testing ✓
