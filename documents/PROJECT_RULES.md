# Project Rules

## Simple Naming Rule

Use clear, descriptive names that a non-technical user can understand.

- Prefer simple words over technical accounting or database jargon.
- Use labels, titles, descriptions, field names, and table names that are easy for non-native English speakers.
- Avoid abbreviations unless they are common in the business, such as SKU, UOM, PO, or SO.
- Do not expose internal implementation terms to users when a plain business word is available.
- Use Title Case for user-facing labels, headings, table columns, and field titles.
- Do not force normal labels to all uppercase. Common business abbreviations such as SKU, UOM, PO, SO, VAT, and EAN may stay uppercase.
- Use `active` / `inactive` language in the UI. In code and database fields, use `is_active`.

Examples:

- Use `inventory_items`, not `inv_mst`.
- Use `sales_price`, not `retail_amt`.
- Use `purchase_price`, not `procurement_rate`.
- Use `stock_on_hand`, not `qty_bal`.
- Use `blocked_reason`, not `inactive_meta`.

## Inventory Rules

- Draft documents must not affect stock.
- Posted documents should not be directly edited; use returns, reversals, corrections, or adjustments.
- Stock reports should read from stock movements and stock balances, not directly from all source documents.
- Keep item master fields clean. Do not store report-only values as editable item fields.

## Voucher Rules

- Draft vouchers must not affect account balances or reports.
- Posted vouchers should not be directly edited; use reversal, void, correction, debit note, or credit note workflows.

## Transaction Workflow Rules

- These workflow standards apply to vouchers, sales, purchases, payments, receipts, stock documents, and future transaction modules.
- Posted documents should be locked and corrected through approved correction documents.
- Transaction screens should reserve a consistent area for approval, attachments, print, and workflow status.
- Cost Center, Project, Department, Auto Reverse Date, and Attachments should be added only when the backend and database save and validate them.

## Rule Ownership

- Frontend UI, validation, layout, theme, messages, and voucher screen rules belong in `documents/FRONTEND_BEST_PRACTICES.md`.
- Backend API, service, transaction, validation, security, and error-handling rules belong in `documents/BACKEND_BEST_PRACTICES.md`.
- Database schema, table, field, index, master-data, and transaction design rules belong in `documents/DATABASE_DESIGN_RULES.md`.
