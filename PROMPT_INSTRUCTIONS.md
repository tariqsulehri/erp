# Prompt Instructions

Use this text at the start of future prompts when asking for code, database, frontend, backend, or architecture changes.

## Full Version

```text
Before making any code or database changes, read and follow AGENTS.md and all relevant files in the documents folder.

Follow these rules strictly:
- Use simple, clear names and labels that non-native English speakers and less technical staff can understand.
- For frontend work, follow documents/FRONTEND_BEST_PRACTICES.md.
- For backend work, follow documents/BACKEND_BEST_PRACTICES.md.
- For database, Prisma, inventory, stock, accounting, or reporting work, follow documents/DATABASE_DESIGN_RULES.md and documents/INVENTORY_TABLES.md.
- Keep frontend and backend as separate apps with separate dependencies and containers.
- Do not start the frontend; it is already running on port 3000.
- Use backend/.env for backend database connection.
- Do not add Redis unless I explicitly ask or there is a clear requirement.
- Explain the plan first if the change affects database schema, business rules, or architecture.
```

## Short Version

```text
Follow AGENTS.md and the documents folder before making changes. Use simple user-friendly names. Apply frontend, backend, and database standards based on the work type. Do not start the frontend on port 3000. Share a plan first for schema or architecture changes.
```

## New Module Prompt

Use this prompt when starting any new ERP module. Replace `[MODULE NAME]` and the module requirements.

```text
Before making any code, UI, backend, database, migration, seed, or documentation change, read and follow AGENTS.md and all relevant files in the documents folder.

Create the [MODULE NAME] module.

Follow the full ERP standards already defined in this repository, including:
- Simple business naming for non-technical and non-native English users.
- Purchase module structure as the reference pattern.
- Page as orchestrator.
- Focused child components.
- Shared generic form fields.
- Hooks for state, filters, support data, totals, and data shaping.
- Helper files for validation, payload building, and business rules.
- API calls through src/lib/api.
- Backend routes should stay thin.
- Business rules must live in backend services/helpers.
- Prisma/PostgreSQL schema must follow DATABASE_DESIGN_RULES.md.
- Use backend pagination and filters for large lists.
- Use settings-based date, number, and currency formatting.
- No hard-coded currency, date format, country, timezone, or account-code rules.
- No silent errors; show clear user messages.
- Posted documents must be read-only and corrected only through approved workflows.
- If this module affects inventory, every posted stock change must create inventory_stock_movements.
- If this module affects accounting, use 10-digit Account Codes and proper posting/ledger rules.

Module requirements:
[WRITE MODULE DETAILS HERE]

First review the current codebase and existing patterns.
Then create a short plan.
After that, implement the module end-to-end without breaking current functionality.
Run relevant type-checks/tests and tell me what was verified.
Also tell me the next suggested step.
```

### Example

```text
Create the Sales Invoice module.

Module requirements:
- Cash and Credit sales.
- Customer selection.
- Warehouse selection.
- Top row item entry like Purchase Voucher.
- Posted sales list with filters.
- Print preview and PDF download.
- Stock should reduce only when posted.
```
