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

## Customer And Supplier Party Rules

- A party can be `Customer`, `Supplier`, or `Customer And Supplier`.
- Use `Main Role` to show the original/base role when a party is both.
- For now, keep one linked GL account for the party, even when it works as both customer and supplier.
- User-facing screens should say `Linked Account`, not technical terms such as AR/AP sub-ledger account.
- Account Codes must be 10 digits using `MM GG SS PPPP`: Main Category, Group, Sub-Group, Posting Account.
- Example Account Code: `0101100001` means `01 01 10 0001`.
- Customer linked accounts should use `0103010001` to `0103999999`.
- Supplier linked accounts should use `0201010001` to `0201999999`.
- Do not create a duplicate party record only because a customer starts supplying items or a supplier starts buying from us.
- New Customer and Supplier records should be `Active` by default.
- Users can mark a Customer or Supplier as `Inactive` only when the party should no longer be used in new transactions.

## Transaction Workflow Rules

- These workflow standards apply to vouchers, sales, purchases, payments, receipts, stock documents, and future transaction modules.
- New transaction modules should follow the Purchase Voucher feature pattern where applicable: entry view, posted/history list, backend filters, read-only detail view, print preview, print, and PDF download.
- Large transaction lists must use backend pagination, backend filters, stable sorting, and summary rows. Do not load full history or line items into the browser list.
- Every module should be scalable, reusable, readable, and easy to maintain. Do not put all logic, UI, formatting, validation, and data access in one large file.
- Posted documents should be locked and corrected through approved correction documents.
- Transaction screens should reserve a consistent area for approval, attachments, print, and workflow status.
- Cost Center, Project, Department, Auto Reverse Date, and Attachments should be added only when the backend and database save and validate them.

## General Settings Rules

- Company profile information belongs to the company record.
- Date format, time zone, locale, country, currency, decimal places, thousand separator, and decimal separator belong to `general_settings`.
- Currency display position belongs to shared settings as `prefix` or `suffix`.
- Application modules should read shared format and currency values from `general_settings`.
- Do not hard-code currency symbols, currency position, date formats, locale names, or separators inside module screens.
- Do not use `$`, `Rs`, or any other currency text directly in UI code, backend messages, reports, or print formats.
- SQL parameter placeholders such as `$1`, `$2`, and `$7` are database syntax and must not be confused with currency display.

## Rule Ownership

- Frontend UI, validation, layout, theme, messages, and voucher screen rules belong in `documents/FRONTEND_BEST_PRACTICES.md`.
- Backend API, service, transaction, validation, security, and error-handling rules belong in `documents/BACKEND_BEST_PRACTICES.md`.
- Database schema, table, field, index, master-data, and transaction design rules belong in `documents/DATABASE_DESIGN_RULES.md`.
