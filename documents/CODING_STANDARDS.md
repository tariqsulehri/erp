# Coding Standards

## Modular Code Rule

- Keep modules highly scalable, reusable, and readable.
- Do not place all business logic, UI logic, formatting, validation, API calls, and styles in one large component or service file.
- Move reusable frontend UI to shared components.
- Move reusable frontend helpers to shared library files.
- Move reusable backend business logic to service/helper layers.
- Keep CSS, theme tokens, spacing, radius, and common visual patterns reusable instead of hard-coded per screen.
- Use comments for important business rules or non-obvious logic only.

## General

- Keep names clear, consistent, and easy to understand.
- Keep business rules in services, not directly in route handlers.
- Validate inputs at API boundaries.
- Use database transactions for posting documents, stock changes, and accounting changes.
- Keep posted transaction records immutable where possible.

## Database

- Use descriptive table names in plural snake_case.
- Use Prisma camelCase field names with snake_case database mappings.
- Use 10-digit numeric text for Account Codes in `MM GG SS PPPP` format.
- Every business table should include:
  - `companyId`
  - `isActive`
  - `createdAt`
  - `updatedAt`
- Use `Decimal` for money, quantity, cost, price, weight, and dimensions.
- Do not use floating point numbers for money or stock quantity.
- Use lookup tables for configurable business values such as category, brand, size, origin, and UOM.
- Use stock movement tables as the source of truth for inventory reports.
- Follow `documents/DATABASE_DESIGN_RULES.md` for database design.

## Frontend and Backend Specific Rules

- Follow `documents/FRONTEND_BEST_PRACTICES.md` for frontend work.
- Follow `documents/BACKEND_BEST_PRACTICES.md` for backend work.
- Follow `documents/DATABASE_DESIGN_RULES.md` for schema, migration, reporting, and transaction design.

## API

- Use simple endpoint names.
- Return clear error messages.
- Do not expose database errors directly to users.
- Keep response field names understandable by frontend developers and business users.

## User-Facing Text

- Use simple labels:
  - `Item Code`
  - `Item Name`
  - `Purchase Price`
  - `Sales Price`
  - `Stock On Hand`
  - `Minimum Stock Level`
- Avoid professional-only terms unless required.
- Prefer short descriptions that explain what the field is for.
