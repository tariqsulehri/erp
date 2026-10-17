# Frontend Testing Guide

This guide matches the current split ERP architecture.

- Frontend: Next.js on `http://localhost:3000`
- Backend: Node.js/Express REST API on `http://localhost:4000/api/v1`
- Database: PostgreSQL through backend Prisma only

The frontend does not run database migrations, database seeds, ORM code, or frontend-hosted business APIs.

## 1. Prerequisites

```bash
node --version
npm --version
```

Expected:

- Node.js 24
- npm 10+

The backend should already be running on port `4000`.

## 2. Install Frontend Dependencies

```bash
cd /Users/tk-lpt-1088/development/react/erp/ERP/frontend
npm install
```

## 3. Configure Frontend API URL

Create or update `frontend/.env.local`:

```bash
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:4000/api/v1
```

## 4. Start Frontend

Only start the frontend when needed. The standard port is `3000`.

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 5. Static Checks

```bash
npm run type-check
npm run lint
```

If lint is not configured for the current phase, `type-check` is the minimum required frontend check.

## 6. Backend API Smoke Checks

Run these from the repository root or any shell while the backend is running:

```bash
curl http://localhost:4000/api/v1/dashboard/summary
curl "http://localhost:4000/api/v1/fiscal-years?page=1&limit=5"
curl "http://localhost:4000/api/v1/products?page=1&limit=5&status=Active"
curl http://localhost:4000/api/v1/products/categories
curl http://localhost:4000/api/v1/products/brands
curl http://localhost:4000/api/v1/products/units-of-measure
```

Expected:

- API returns JSON.
- Business validation errors return clear messages.
- No endpoint returns a generic silent failure.

## 7. Manual UI Smoke Tests

### Dashboard

- Open `/dashboard`.
- Confirm summary cards load from backend REST.
- Confirm the page does not show raw API errors.

### Chart Of Accounts

- Open the chart of accounts page.
- Confirm the tree view shows the 10-digit hierarchy.
- Confirm posting accounts are visible under their parent group.

### Products

- Open product catalogue.
- Confirm filters work.
- Confirm brand, sale rate, minimum sale rate, and stock columns align correctly.
- Confirm searchable dropdowns load categories, brands, and units of measure.

### Purchase Voucher

- Open the purchase voucher page.
- Confirm header order is:
  - Purchase Number
  - Purchase Date
  - Payment Type
  - Bill Date
  - Supplier Bill No
  - Supplier
  - Warehouse
  - Reference Number
- Add an item using the top input row.
- Confirm quantity, rate, discount, tax, freight, and totals are right aligned and formatted from settings.
- Confirm the row clears after adding an item.
- Confirm rows can be changed, deleted, and reordered.
- Confirm posted purchase updates stock through backend stock movement records.

### Vouchers

- Open bank receipt, bank payment, cash receipt, cash payment, and journal voucher screens.
- Confirm action buttons are at the top.
- Confirm line-item and summary areas are consistent.
- Confirm line items scroll only inside the defined line area when many rows exist.
- Confirm no full-page horizontal or vertical scrolling is introduced by standard voucher content.

### Customers And Suppliers

- Open customers and suppliers pages.
- Confirm list view and input view are separate.
- Confirm default status is active.
- Confirm party type and business type are clear selectable controls.
- Confirm currency is selectable and uses general settings defaults.
- Confirm numeric inputs are right aligned.

## 8. Formatting Checks

Review any changed screen for:

- Title Case labels.
- Required fields marked with `*`.
- Numeric and amount fields right aligned.
- Currency symbol and date format from settings.
- Select controls showing a chevron or clear selectable state.
- Error messages displayed near the related field.
- No unexplained abbreviations in labels.

## 9. Performance Checks

For large lists:

- Use backend pagination.
- Keep filters server-side for large datasets.
- Avoid loading full purchase, product, customer, or ledger history into one frontend state object.
- Keep analytics queries aggregated on the backend.

## 10. Handover Checklist

- [ ] `npm run type-check` passes in `frontend`.
- [ ] Affected backend REST endpoints were smoke-tested.
- [ ] No frontend ORM, database migration, seed, or frontend-hosted business API instructions were added.
- [ ] Labels and field names follow `AGENTS.md`.
- [ ] Numeric, date, and currency behavior follows configurable settings.
