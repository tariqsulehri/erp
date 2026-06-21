# Accounting Posting Rules

These rules apply to every module that creates accounting impact, including purchases, sales, purchase returns, sale returns, bank receipts, bank payments, cash receipts, cash payments, journal vouchers, debit notes, and credit notes.

## Source Of Truth

All posted accounting transactions must create accounting records in:

- `vouchers`
- `voucher_lines`

Business document tables keep the original business document, but they are not the accounting ledger.

Examples:

- `purchase_invoices` stores the purchase document.
- `sales_invoices` stores the sale document.
- `purchase_returns` stores the purchase return document.
- `sales_returns` stores the sale return document.
- Bank and cash document tables store their own business voucher header and extra fields.

After posting, Ledger Report, Trial Balance, Balance Sheet, Income Statement, Cash Book, Bank Book, Customer Ledger, and Supplier Ledger must read accounting impact from posted `voucher_lines` joined to `vouchers`.

## Voucher Header Totals

`vouchers.total_debit` and `vouchers.total_credit` store the sum of the accounting voucher lines.

Rules:

- `total_debit` must equal the sum of all `voucher_lines.dr_amount` for that voucher.
- `total_credit` must equal the sum of all `voucher_lines.cr_amount` for that voucher.
- `total_debit` must always equal `total_credit`.
- These totals are accounting totals, not only the customer payable, supplier payable, cash amount, or net invoice amount.
- Do not store an unbalanced or partial accounting voucher.

## Business Document Header Totals

Business documents should store their own summary amounts for fast list screens, print formats, audit, and supplier/customer bill comparison.

For a purchase invoice, store:

- `gross_amount`
- `discount_amount`
- `tax_amount`
- `freight_amount`
- `other_charges_amount` when supported
- `net_amount`

Purchase formula:

```text
Net Amount = Gross Amount - Discount Amount + Tax Amount + Freight Amount + Other Charges
```

The source document totals must match the posted accounting voucher lines.

## Purchase Invoice Posting

For a posted purchase invoice:

```text
Dr Inventory / Purchase Account          Gross Amount
Dr Purchase Tax / VAT Recoverable        Tax Amount
Dr Freight / Purchase Charges            Freight Amount
Dr Other Purchase Charges                Other Charges
Cr Purchase Discount Received            Discount Amount
Cr Supplier / Cash Account               Net Amount
```

Example:

```text
Gross Amount      477.50
Discount Amount     1.00
Tax Amount         50.00
Freight Amount      0.00
Net Amount        526.50

Dr Inventory Finished Goods             477.50
Dr VAT Recoverable                       50.00
Cr Supplier Payable                     526.50
Cr Purchase Discount Received             1.00

Voucher Total Debit                     527.50
Voucher Total Credit                    527.50
```

Do not hide purchase discount by reducing only the Inventory debit if the business needs `Purchase Discount Received` to appear in ledger reports.

## Sale Invoice Posting

For a posted sale invoice:

```text
Dr Customer / Cash Account               Net Amount
Dr Sales Discount Allowed                Discount Amount
Cr Sales Revenue                         Gross Amount
Cr Sales Tax Payable                     Tax Amount
Cr Freight / Other Income                Freight Or Other Charges, when treated as income
```

If stock costing is enabled, also post cost of goods sold and inventory reduction in the same posting transaction.

## Purchase Return Posting

Purchase return posting must reverse the accounting effect of purchase for returned goods and related tax, discount, freight, and other charges according to the approved business rule.

The return document should store its own totals and create a balanced accounting voucher.

For a posted purchase return:

```text
Dr Supplier / Cash Account               Net Amount
Dr Purchase Discount Received            Discount Amount
Cr Inventory / Purchase Account          Gross Amount
Cr Purchase Tax / VAT Recoverable        Tax Amount
Cr Freight / Purchase Charges            Freight Amount
Cr Other Purchase Charges                Other Charges
```

Purchase return stock posting must create an `inventory_stock_movements` row with `quantity_out` and `movement_kind = PURCHASE_RETURN`.

The source purchase return header must store:

- `gross_amount`
- `discount_amount`
- `tax_amount`
- `freight_amount`
- `other_charges_amount` when supported
- `net_amount`

Purchase return formula:

```text
Net Amount = Gross Amount - Discount Amount + Tax Amount + Freight Amount + Other Charges
```

## Sale Return Posting

Sale return posting must reverse the accounting effect of sale for returned goods and related tax, discount, freight, and other charges according to the approved business rule.

The return document should store its own totals and create a balanced accounting voucher.

## Bank And Cash Posting

Bank and cash receipts/payments must create balanced accounting voucher lines.

Examples:

- Bank Receipt: Debit Bank, Credit received-from account.
- Bank Payment: Debit paid-to account, Credit Bank.
- Cash Receipt: Debit Cash, Credit received-from account.
- Cash Payment: Debit paid-to account, Credit Cash.

Cheque, clearing, bank, and deposit details belong in the business document tables. The accounting impact belongs in `vouchers` and `voucher_lines`.

## Posting Safety

- Draft documents must not create ledger impact.
- Posted documents should not be edited directly.
- Corrections must use reversal, return, debit note, credit note, void, or adjustment workflows.
- Posting must run inside one database transaction.
- Posting must protect against duplicate posting in a multi-user environment.
- Stock movement and accounting voucher posting must succeed or fail together when the document affects both stock and accounts.
