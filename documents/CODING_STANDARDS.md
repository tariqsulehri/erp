# Coding Standards

## General

- Keep names clear, consistent, and easy to understand.
- Keep business rules in services, not directly in route handlers.
- Validate inputs at API boundaries.
- Use database transactions for posting documents, stock changes, and accounting changes.
- Keep posted transaction records immutable where possible.

## Database

- Use descriptive table names in plural snake_case.
- Use Prisma camelCase field names with snake_case database mappings.
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
