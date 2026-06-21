# Coding Standards

These standards apply to both frontend and backend code. Layer-specific rules live in the frontend, backend, and database documents.

## Architecture

- Keep modules scalable, reusable, readable, and easy to maintain.
- Do not put business logic, UI logic, formatting, validation, API calls, database access, styles, and print/report logic in one large file.
- Split large features by responsibility: Entry View, List View, Detail View, Analytics View, Print Preview, Toolbar, Filters, Summary, Line Items, validation, payload mapping, and service logic.
- Follow the Purchase module pattern for new frontend modules.
- Keep route handlers/controllers thin.
- Keep business rules in services, domain helpers, or repositories.
- Keep API calls in dedicated frontend API clients.
- Move shared frontend controls and helpers to reusable files before duplication spreads.
- Move shared backend logic to reusable services/helpers before duplication spreads.

## Reuse

- Use shared generic form components for common text, numeric, date, select, searchable select, checkbox, and textarea fields.
- Avoid repeating raw form input markup across purchases, sales, vouchers, inventory, customers, and suppliers.
- Use shared helpers for date parsing, numeric cleanup, amount formatting, HTML escaping, debounced search, friendly error messages, account-code generation, numbering, settings, posting, and validation.
- Keep CSS, theme tokens, spacing, radius, chart styles, status colors, and common visual patterns reusable.
- Prefer shared settings, constants, lookup tables, configuration, or theme tokens over hard-coded values.

## Naming

- Keep names clear, consistent, and easy to understand.
- Use simple business words.
- Avoid unexplained abbreviations.
- Use descriptive endpoint, function, field, and table names.
- Keep response field names understandable by frontend developers and business users.

## Validation And Errors

- Validate inputs at API boundaries.
- Frontend validation improves user experience; backend validation is always required.
- Return clear error messages.
- Do not expose database errors, stack traces, connection strings, or secrets to users.
- Never swallow exceptions silently.
- If a multi-step action partly succeeds, return or display a message that explains exactly what happened.

## Transactions And Posting

- Use database transactions for posting documents, voucher lines, stock movement, and balance updates.
- Draft records must not affect ledger, stock, cash/bank, customer, or supplier balances.
- Posted transaction records should be immutable where possible.
- Correct posted documents through approved correction workflows.
- Protect posting flows from duplicate posting and multi-user race conditions.

## Data Types

- Use `Decimal` for money, quantity, cost, price, tax rate, discount rate, weight, and dimensions.
- Do not use floating point numbers for money or stock quantity.
- Store Account Codes as text so leading zeros are preserved.

## Comments

Add comments only where they help future developers understand:

- important business rules
- non-obvious calculations
- posting/concurrency behavior
- transaction boundaries
- integration constraints

Do not comment obvious code.

## Required References

- Follow `documents/FRONTEND_BEST_PRACTICES.md` for frontend work.
- Follow `documents/BACKEND_BEST_PRACTICES.md` for backend work.
- Follow `documents/DATABASE_DESIGN_RULES.md` for schema, migration, reporting, and transaction design.
