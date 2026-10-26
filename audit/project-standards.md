# Project Module: ERP Platform (Financial & Inventory Management System)

**Status:** Vetted against current ERP project rules and architectural documents.
**Loads with dimensions:** security, architecture, data, testing, code-health, ux-design, accessibility, documentation.
**How it is used:** Load it at Stage 3 together with stack modules (`node-express`, `react`, `prisma-postgres`, `docker-cicd`). It adds this ERP system's domain rules. A violation of a rule below is an audit finding.

**Authoritative Sources, in order of precedence:**
1. [`documents/PROJECT_RULES.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/PROJECT_RULES.md) (Core rules, simple naming, modularity)
2. [`DESIGN.md`](/Users/tk-lpt-1088/development/react/erp/ERP/DESIGN.md) (Calm Ledger visual design system, tokens, screen anatomy)
3. [`documents/ACCOUNTING_POSTING_RULES.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/ACCOUNTING_POSTING_RULES.md) (Double-entry accounting, 10-digit codes, posting invariants)
4. [`documents/INVENTORY_SCHEMA.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/INVENTORY_SCHEMA.md) & [`INVENTORY_TABLES.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/INVENTORY_TABLES.md) (Stock movements and snapshots)
5. [`documents/FRONTEND_BEST_PRACTICES.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/FRONTEND_BEST_PRACTICES.md) (Vouchers, tables, validations, forms)
6. [`documents/BACKEND_BEST_PRACTICES.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/BACKEND_BEST_PRACTICES.md) (Service layers, validation, transactions)
7. [`documents/DATABASE_DESIGN_RULES.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/DATABASE_DESIGN_RULES.md) (Schema, indexing, multi-tenant isolation)
8. [`REMEDIATION_PLAN.md`](/Users/tk-lpt-1088/development/react/erp/ERP/REMEDIATION_PLAN.md) (Prioritized vulnerability and architecture remediation roadmap)

---

## 1. Accounting & General Ledger Posting Standards

- [ ] **10-Digit Account Codes:** All Account Codes must follow the 10-digit numeric format `MM GG SS PPPP` (Main Category, Group, Sub-Group, Posting Account). Example: `0101100001`. Old 4, 6, 7, or 8-digit formats are strictly forbidden in new code.
- [ ] **Party Sub-Ledger Account Ranges:** Customer linked accounts must fall within `0103010001`–`0103999999`. Supplier linked accounts must fall within `0201010001`–`0201999999`.
- [ ] **Strict Double-Entry Balance:** Every posted voucher must enforce $\sum \text{Debits} = \sum \text{Credits}$ before persistence. Unbalanced vouchers must return an HTTP 400 error.
- [ ] **Accounting Immutability:** Posted documents in `vouchers` and `voucher_lines` are immutable. They must never be updated or deleted directly. Corrections must execute via approved workflows: reversal, void, return, debit/credit note, or adjustment.
- [ ] **Source of Truth vs. Summary:** Source document totals belong in business document tables (e.g. `sale_invoices`, `purchase_invoices`), while general ledger financial impact is stored in `vouchers.total_debit` and `vouchers.total_credit`.
- [ ] **Fiscal Period Validation:** Every transaction date must be validated against the active company's fiscal calendar. Posting to closed or unconfigured fiscal periods must be rejected.
- [ ] **Financial Precision Math:** All monetary calculations in backend services must use `decimal.js` to eliminate JavaScript floating-point rounding errors.

---

## 2. Inventory & Stock Tracking Standards

- [ ] **Movement Record on Every Post:** Every posted inventory transaction (sales, purchases, adjustments, transfers, returns) must write an immutable record to `inventory_stock_movements`.
- [ ] **Current Snapshot Synchronization:** `inventory_stock_balances` serves as a fast-read snapshot and must be updated atomically within the same database transaction as the movement.
- [ ] **Drafts Never Alter Stock:** Draft sales orders, draft purchase orders, and unapproved documents must never affect stock balances or write stock movements.
- [ ] **Warehouse & Branch Consistency:** Warehouses must belong to the selected branch. Cross-warehouse transfers must prevent identical source and destination locations.
- [ ] **Configurable Master Data:** Category, brand, size, origin, and unit of measure (UOM) must use configurable master data from database tables, not free text inputs or hardcoded values.

---

## 3. Multi-Tenant Isolation & Security Standards

- [ ] **Zero-Trust Tenant Authorization:** Every API request must supply `x-company-id`. The backend must verify that the requested company ID exists within the authenticated user's authorized company list (`req.user.companies`). Tenant context spoofing must return HTTP 403 Forbidden.
- [ ] **Database Query Scoping:** Every Prisma query and raw SQL query must filter by `company_id`.
- [ ] **Cryptographic JWT Authentication:** All `/api/v1/*` routes (except `/health`) must pass through `authMiddleware` verifying Bearer JWT signatures against `env.JWT_SECRET`.
- [ ] **No Secrets in Source or Deployment:** Hardcoded JWT secret fallbacks (e.g. in `auth.options.ts`), database passwords in `deployment/.env*`, or test credentials must be eliminated.
- [ ] **Edge Server Route Protection:** NextAuth `withAuth` middleware (`middleware.ts`) must guard all dashboard routes at the edge before serving client HTML.

---

## 4. UI/UX & Calm Ledger Design System Standards

- [ ] **Restrained Palette (Calm Ledger):** Surfaces use Workspace Ground (`#f5f6f8`), Paper (`#ffffff`), and Paper Alt (`#f7f9fb`). Primary accent is Ledger Blue (`#1f56c7`) for interactive actions only. Navigation Navy (`#182130`) exists in the sidebar and nowhere else.
- [ ] **No Decorative Gradients or Gimmicks:** No gradient headers, gradient icon tiles, loud neon accents, or pastel stat-card rows. Flat at rest; 1px subtle rules.
- [ ] **Compact Enterprise Density:** 32px standard control height (`--control-h`), 36px table row height (`--row-h`), 6px control radius, 8px container radius.
- [ ] **12px Floor Rule:** No readable user text smaller than 12px (`var(--font-size-xs)` / `var(--font-size-2xs)`).
- [ ] **Tabular Figures for Numbers:** All amounts, balances, debit/credit totals, stock quantities, and counts must use tabular figures (`font-variant-numeric: tabular-nums`) and be right-aligned.
- [ ] **Dynamic Formatting from Settings:** Never hardcode currency symbols (`$`, `Rs`) or date formats in screens. All formatting must use `formatMoney`, `formatNumber`, and `formatDate` driven by company settings.
- [ ] **Title Case User Text:** Labels, buttons, table headers, and menu items use Title Case plain words ("Item Name", "Sales Price", "Save Voucher"). Never uppercase headings.
- [ ] **Token-Only Colors:** Components must never contain hardcoded hex values or raw `rgba()` literals. All styles must draw from `design-tokens.css`.
- [ ] **Accessible Inputs:** Every input must be associated with a `<FieldLabel htmlFor="...">` and include `aria-invalid` and `aria-describedby` when errors occur.

---

## 5. Architecture & Code Quality Standards

- [ ] **Purchase Module Architectural Pattern:** Large transaction screens must follow the Purchase module structure: orchestrator page, child components (Toolbar, Header Form, Line Table, Summary, Filters), custom hooks for state/derived totals, domain helpers for business rules/validation, and API calls isolated in `src/lib/api`.
- [ ] **No Monolithic 500+ Line Screens:** Monolithic screens (e.g. `WarehouseManagementPage.tsx`, `PostedVouchersView.tsx`) must be decomposed into focused child modules.
- [ ] **No Duplicated Style Objects:** Deprecate inline style files (`PurchaseVoucherStyles.ts`, `VoucherShared.ts`) in favor of shared CSS classes in `globals.css` (`.data-table`, `.panel`, `.form-grid`).
- [ ] **Thin Route Handlers:** Backend Express routes must only parse input, call domain services, and return responses. Business logic, sequence generation, and transaction handling belong in service layers.
- [ ] **Input Validation with Zod:** Every backend endpoint must validate request bodies and query parameters with Zod schemas before service execution.
- [ ] **Concurrency & Sequence Generation:** Alphanumeric `ORDER BY DESC LIMIT 1` sequence queries must be replaced with atomic sequences or `SELECT ... FOR UPDATE` pessimistic locks to eliminate draft race conditions.
- [ ] **Non-Root Docker Security:** Both `backend/Dockerfile` and `frontend/Dockerfile` must run under the unprivileged `USER node` account.

---

## 6. Testing & Quality Gates

- [ ] **Automated Test Coverage:** Core financial services (double-entry balance, fiscal period guards, 10-digit account code validation, stock balance deduction) must have unit and integration tests with Vitest.
- [ ] **Zero React Hook Warnings:** Fix stale closure risks and missing dependencies in `useEffect`, `useCallback`, and `useMemo` hooks.
- [ ] **Type-Safety Cleanliness:** Both `npm run type-check` in frontend and `npm run type-check` in backend must pass with 0 errors.
