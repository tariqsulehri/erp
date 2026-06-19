# Backend Best Practices

## API Design

- Use simple route and field names.
- Validate every request on the backend.
- Return clear error messages.
- Do not expose raw database errors to users.
- Keep route handlers thin and move business rules into services.

## Database and Prisma

- Use descriptive table names in plural snake_case.
- Use Prisma camelCase field names with `@map` for snake_case database columns.
- Every business table should include:
  - `companyId`
  - `isActive`
  - `createdAt`
  - `updatedAt`
- Use `Decimal` for money, cost, price, quantity, weight, and dimensions.
- Do not use floating point numbers for financial or inventory quantities.
- Use lookup tables for configurable values.
- Follow `documents/DATABASE_DESIGN_RULES.md` for detailed schema rules.

## Transactions

- Use database transactions when posting documents.
- Lock affected balance rows when stock, supplier balance, customer balance, or cash/bank balance changes.
- Draft documents should not affect stock or accounts.
- Posted documents should not be directly edited.
- Corrections should be made with reversal, return, debit note, credit note, or adjustment documents.
- Posting must protect against two users posting the same document at the same time.
- Balance updates must happen in the same transaction as ledger/movement inserts.

## Inventory

- Every posted inventory transaction must create a `inventory_stock_movements` record.
- `inventory_stock_movements` is the inventory history source of truth.
- `inventory_stock_balances` is a fast current-balance snapshot.
- Reports should read from `inventory_stock_movements` and `inventory_stock_balances`.

## Audit and Security

- Store who created and updated important records.
- Store who posted or reversed transaction documents.
- Check user permissions on the backend.
- Never trust company/user IDs only from the frontend.
- Keep tenant/company filtering enforced in every query.

## Error Handling

- Use consistent error shapes.
- Log technical error details on the server.
- Return simple messages to the frontend.
- Include enough context for support staff without exposing secrets.

## Service Structure

- Keep controllers/routes small.
- Put business rules in service files.
- Put database access behind clear repository/helper functions when logic becomes complex.
- Keep posting flows explicit and easy to audit.
- Avoid hidden side effects in utility functions.
