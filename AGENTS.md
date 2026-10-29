# Agent Instructions

These instructions apply to all coding work in this repository, by any agent (Claude Code, Codex, Gemini /
Antigravity, Cursor, Copilot) or person.

## Start Here

Read `documents/CODEBASE_GUIDE.md` first. It is the map of the codebase: folders, the backend and frontend
patterns, the shared document lifecycle (Draft, Post, Cancel, Reverse), permissions, commands, tests,
database changes and delivery. Then read the rule documents below for the layer you change.

## Working Rules For Agents

- **Branching Policy:** `master` is our primary source branch for all active work and feature branches. `main` is strictly reserved as a backup of the last known stable running code; never use `main` for active work. Work on a feature branch per change and merge to `master`. Never commit straight to `master` without passing checks.
- **Prove it before committing.** Run the checks in `documents/CODEBASE_GUIDE.md` section 7 and commit only
  when they all pass. Add or update tests for every behaviour you change. Follow `documents/DEFINITION_OF_DONE.md`.
- **Ask before anything hard to undo:** pushing, merging, deploying, deleting data, dropping columns or
  tables, or changing a shared server. Back up the database before any migration.
- **Never remove a working feature** to make a change easier, and never bypass a business control
  (approval two-person rule, access scope, period locks) by writing to the database directly.
- **Match the code around you.** Reuse the shared parts named in the guide instead of writing new versions.
- **Report honestly.** Say what was tested, what was not, and what still needs a person to check.
- **Keep the guide true.** When you change a pattern, an endpoint, a permission or a workflow, update
  `documents/CODEBASE_GUIDE.md` (and `documents/INVENTORY_CURRENT_STATE.md` for inventory) in the same change.

## Required Reading Before Changes

Before making code or database changes, read and follow:

- `documents/CODEBASE_GUIDE.md`
- `documents/PROJECT_RULES.md`
- `documents/CODING_STANDARDS.md`
- `documents/DEFINITION_OF_DONE.md`

For frontend work, also read:

- `documents/FRONTEND_BEST_PRACTICES.md`
- `DESIGN.md` (Calm Ledger visual standard: tokens, screen anatomy, components, do's and don'ts)

For backend work, also read:

- `documents/BACKEND_BEST_PRACTICES.md`

For database, Prisma, inventory, stock, accounting, posting, or reporting work, also read:

- `documents/DATABASE_DESIGN_RULES.md`
- `documents/ACCOUNTING_POSTING_RULES.md`
- `documents/INVENTORY_TABLES.md`
- `documents/INVENTORY_SCHEMA.md`
- `documents/BANK_DEPOSIT_SCHEMA.md`
- `documents/INVENTORY_CURRENT_STATE.md` (what is built, what is still missing)

## Non-Negotiable Rules

### No Secrets In Git

Nothing secret is ever committed, in any file, not even in a comment, a test, a doc, or an example:
API keys, tokens, passwords, connection strings with a password, JWT or session secrets, private keys,
certificates, `.env` files (other than `*.example`), credentials files, and database dumps.

- Secrets live in git-ignored `.env` files on each machine or server, and in CI secrets.
- Examples use placeholders only: `CHANGE_ME`, `<a long password>`, `${JWT_SECRET}`, or an empty value.
- Code reads secrets from the environment (`process.env…`), never from a literal.
- Enforced automatically:
  - before every commit by `.githooks/pre-commit` (turn it on once per clone: `npm run setup:hooks`);
  - on every push and pull request by the CI job "No Keys Or Passwords In Git".
  Both run `scripts/check-secrets.mjs` (every line, comments included) and gitleaks.
- Never bypass the check with `git commit --no-verify` to get a secret in.
- A throwaway test value that is not a real secret may be added to `.secrets-allowlist` (and the stopwords in
  `.gitleaks.toml`); every addition is reviewed like code.
- If a secret is ever committed or pushed, treat it as leaked: rotate it at once, then remove it.
  Removing it from the file does not remove it from git history.

### No Fabricated Visualization Data

Never populate or fabricate graphs, charts, or summary tiles with static dummy numbers or invented values. All visualization values must derive dynamically from the database and reflect real, authenticated ledger/business data. If data is absent, show "No data", never invented values.

### Functional Invariance During Visual Refactoring

Never touch, alter, or break component business logic, validation rules, event handlers, props contracts, data fetching, state flows, or calculations when working on look and feel, themes, or styling. Visual improvements must remain strictly presentation-only and preserve all underlying component behavior. CSS custom properties and tokens must always serve as the single source of truth for styling.

### No Scroll-Blocking Containers & Screen-Fit Standards

Never clip page content with `overflow: hidden` on outer page wrappers or `.page-shell` without an inner scrollable container. When page content exceeds the viewport height, smooth vertical scrolling (`overflow-y: auto`) must always remain enabled so graphs, tables, and values are never trimmed off or inaccessible at the bottom. Dashboard and overview grids must be designed to fit common laptop viewports (768px–900px) cleanly on a single screen without unnecessary vertical sprawl by keeping padding compact (`8px`–`12px`), tile heights sleek (~64px–72px), and chart plot heights proportional (~180px–190px).

### Overlapping Slide-Over Drawer Standard

Document and transaction detail inspection views (Vouchers, Purchases, Sales, Stock Transfers, Stock Adjustments, Returns, and complex records) must render inside the standardized elevated slide-over `Drawer` overlay (`Drawer.tsx`, default `size="lg"`: `min(900px, 96vw)`) floating above the grid with a backdrop scrim, rather than squeezing the underlying list table into a narrow side-by-side column. The list table must remain 100% wide and intact. Inside the drawer, line item descriptions, SKU codes, prices, and quantities must render in full un-truncated width. All modal dialogs and slide-overs must consume the shared `Modal.tsx` and `Drawer.tsx` components with standard sizes (`sm`, `md`, `lg`, `xl`), accessible focus trapping (`useDialogFocus`), backdrop dismissal, and `Escape` key handling.

**Document Detail Anatomy & Uniform Heading Rule:**
All current and upcoming document detail views (Invoices, Transfers, Adjustments, Vouchers, Returns) must strictly follow the unified `DocumentDetailPanel` pattern:
1. **Descriptive Top Heading:** The drawer title must clearly describe the document type (e.g. `Voucher Details`, `Stock Transfer Details`, `Stock Adjustment Details`, `Opening Stock Details`, `Purchase Invoice Details`, `Sales Invoice Details`, `Purchase Return Details`, `Sale Return Details`). Never use only the bare document ID or reference code as the heading.
2. **Standard Header Actions:** Top-right actions must offer the Edit Draft icon button (when draft and editable), Print icon button, and Close button (`IconX`).
3. **Structured Metadata Grid (`DetailFields`):** Starts with Document No., Date, Document Type, and Status badge (`StatusChip`), followed by parties, locations, references, posted/cancelled timestamps, and description.
4. **Clean Line Items Table (`DetailLinesTable`):** Rendered with standard columns (`No.`, `Item Code` / `Account Code`, `Item Description` / `Account Name`, `UOM` / `Debit`, `Quantity` / `Credit`, `Unit Price` / `Rate`, `Amount` / `Total Cost`).
5. **Right-Aligned Totals (`DetailTotals`):** Totals summary neatly aligned to the right.
6. **Lifecycle Guidance Note (`DetailNote`):** Explains whether the document is a Draft, Posted, or Reversed/Cancelled.
7. **Bottom Action Footer (`DetailActions`):** Action buttons (Post, Edit Draft, Reverse, Cancel) must be located at the bottom of the drawer, never placed abruptly as raw top banners under the header.


### Simple Naming

Use clear, descriptive names that are easy for non-native English speakers and less technical staff to understand.

- Use simple business words.
- Avoid unexplained abbreviations.
- Avoid professional-only jargon in labels, titles, descriptions, and field names.
- Prefer descriptive table names over short technical names.
- Use Title Case for user-facing labels and table headings.

Examples:

- Use `inventory_items`, not `inv_mst`.
- Use `inventory_stock_movements`, not `stk_trn`.
- Use `sales_price`, not `rate_out`.
- Use `blocked_reason`, not `inactive_meta`.

### Modular Architecture

Every module must be scalable, reusable, readable, and easy to maintain.

- Do not put business logic, UI logic, validation, formatting, API calls, data mapping, styles, and print/report logic in one large file.
- Split large screens into focused files such as Entry View, List View, Detail View, Analytics View, Print Preview, Toolbar, Summary, Line Items, and shared filters.
- New frontend modules must follow the Purchase module pattern: page as orchestrator, focused child components, shared field controls, hooks for state/data shaping, helper files for validation/payload/business rules, API calls in `src/lib/api`, and separate print/report logic.
- Move reusable frontend controls to shared component files.
- Move reusable frontend helpers to shared library files.
- Move backend business rules to service/domain/repository/helper layers. Route handlers should stay thin.
- Reuse theme tokens, shared styles, constants, lookup tables, and settings instead of hard-coded values.
- Add comments only for important business rules, non-obvious calculations, concurrency/transaction behavior, or integration constraints.

### Frontend

- Frontend forms must validate user input before calling the backend, but backend validation is still required.
- Filter controls across list toolbars (Status, Direction, Business Type, Warehouse, Category, UOM Type, etc.) must always use dropdowns with search (`SearchableSelect`) rather than segmented button rows (`SegmentedControl`) or plain `<select>` elements.
- Frontend UI, validation, theme, layout, voucher screen, and user-message rules belong in `documents/FRONTEND_BEST_PRACTICES.md`.
- Sales, purchases, payments, receipts, vouchers, stock, and future transaction screens must follow the shared transaction module rules in the frontend practices document.

### Backend

- Backend route handlers should stay thin.
- Put business rules, validation, posting, numbering, and transaction behavior in service/domain layers.
- Backend API, service, validation, transaction, security, and error-handling rules belong in `documents/BACKEND_BEST_PRACTICES.md`.

### Database

- Database design must be clear, auditable, multi-company safe, and transaction-safe.
- Database schema, Prisma, table, field, index, master-data, and transaction design rules belong in `documents/DATABASE_DESIGN_RULES.md`.

## Accounting Rules

Use 10-digit numeric text for Account Codes.

- Account Codes follow `MM GG SS PPPP`: Main Category, Group, Sub-Group, Posting Account.
- Example: `0101100001` means `01 01 10 0001`.
- Customer linked accounts use `0103010001` to `0103999999`.
- Supplier linked accounts use `0201010001` to `0201999999`.
- Do not introduce older 4-digit, 6-digit, 7-digit, or 8-digit Account Code rules in new code.

Posted accounting documents should not be directly edited. Use approved correction workflows such as reversal, void, return, debit note, credit note, or adjustment.

All posted accounting impact must be stored in `vouchers` and `voucher_lines`. Business document tables store source document totals, while `vouchers.total_debit` and `vouchers.total_credit` store the sum of accounting voucher lines.

## Inventory Rules

Every posted inventory transaction must create a stock movement record.

- `inventory_stock_movements` is the source of truth for inventory history.
- `inventory_stock_balances` is a current stock snapshot for fast reads.
- Draft documents must not affect stock.
- Posted stock/accounting documents should not be directly edited.
- Saving and posting happen in one database transaction: if posting is refused, nothing is saved.
- The Inventory account must always equal total stock value. Any change to stock value posts its voucher in
  the same transaction (Opening Stock posts Dr Inventory / Cr the Opening Balance Account).
- Posted Stock Transfers, Stock Adjustments and Opening Stock are corrected with Reverse, which gives back the
  exact posted cost. Opening Stock is accepted once per item per Branch or Warehouse.
