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

## Posting Account Reference

Every posting rule must identify accounts by both Account Code and Account Title.

`voucher_lines` must store the resolved account snapshot used at posting time:

- `account_id`
- `account_code`
- `account_name`
- `dr_amount`
- `cr_amount`

Do not post only by account title. Account title can change later; Account Code is the stable business reference shown in ledgers and reports.

Default system accounts currently used by setup services:

| Account Code | Account Title | Type | Used For |
| --- | --- | --- | --- |
| `0101100101` | Cash In Hand | Asset | Cash sales, cash purchases, cash receipts, cash payments |
| `0101300301` | Inventory Finished Goods | Asset | Inventory value for purchases, sales cost, returns, and stock adjustments |
| `0101400301` | VAT Recoverable | Asset | Recoverable tax on purchases and purchase returns |
| `0201300101` | Sales Tax Payable | Liability | Output tax on sales and sale returns |
| `0401100101` | Sales Revenue | Revenue | Product sales revenue |
| `0401200101` | Freight Income | Revenue | Freight or delivery charged to customer |
| `0401300101` | Stock Adjustment Gain | Revenue | Stock adjustment increase value |
| `0501100101` | Cost Of Goods Sold | Expense | Cost side of sales and sale returns |
| `0502100401` | Freight And Delivery | Expense | Freight or delivery cost on purchases |
| `0502100501` | Purchase Discount Received | Expense with credit normal balance | Purchase discount received |
| `0502200101` | Sales Discount Allowed | Expense | Discount allowed to customer |
| `0502300101` | Stock Adjustment Loss | Expense | Stock adjustment decrease value |

Party linked account ranges:

| Range | Account Title Example | Used For |
| --- | --- | --- |
| `0103010001` to `0103999999` | Customer Receivable - Customer Name | Credit sales and customer refunds |
| `0201010001` to `0201999999` | Supplier Payable - Supplier Name | Credit purchases and supplier returns |

Bank accounts must post to the ledger account linked to `bank_accounts.ledger_account_id`. The Bank module stores bank name, account title, and bank account number, but the accounting voucher must use the linked Chart of Accounts posting account.

## Purchase Invoice Posting

For a posted purchase invoice:

| Dr / Cr | Account Code | Account Title | Amount |
| --- | --- | --- | --- |
| Dr | `0101300301` | Inventory Finished Goods | Gross Amount |
| Dr | `0101400301` | VAT Recoverable | Tax Amount |
| Dr | `0502100401` | Freight And Delivery | Freight Amount |
| Dr | Configured expense account | Other Purchase Charges | Other Charges |
| Cr | `0502100501` | Purchase Discount Received | Discount Amount |
| Cr | `0201010001` to `0201999999` | Supplier Payable - Supplier Name | Net Amount for Credit Purchase |
| Cr | `0101100101` | Cash In Hand | Net Amount for Cash Purchase |

Example:

```text
Gross Amount      477.50
Discount Amount     1.00
Tax Amount         50.00
Freight Amount      0.00
Net Amount        526.50

Dr 0101300301 Inventory Finished Goods             477.50
Dr 0101400301 VAT Recoverable                       50.00
Cr 0201010001 Supplier Payable - Supplier Name     526.50
Cr 0502100501 Purchase Discount Received             1.00

Voucher Total Debit                     527.50
Voucher Total Credit                    527.50
```

Do not hide purchase discount by reducing only the Inventory debit if the business needs `Purchase Discount Received` to appear in ledger reports.

## Sale Invoice Posting

For a posted sale invoice:

| Dr / Cr | Account Code | Account Title | Amount |
| --- | --- | --- | --- |
| Dr | `0103010001` to `0103999999` | Customer Receivable - Customer Name | Net Amount for Credit Sale |
| Dr | `0101100101` | Cash In Hand | Net Amount for Cash Sale |
| Dr | `0502200101` | Sales Discount Allowed | Discount Amount |
| Cr | `0401100101` | Sales Revenue | Gross Amount |
| Cr | `0201300101` | Sales Tax Payable | Tax Amount |
| Cr | `0401200101` | Freight Income | Freight Amount charged to customer |

If stock costing is enabled, also post cost of goods sold and inventory reduction in the same posting transaction.

| Dr / Cr | Account Code | Account Title | Amount |
| --- | --- | --- | --- |
| Dr | `0501100101` | Cost Of Goods Sold | Cost Amount |
| Cr | `0101300301` | Inventory Finished Goods | Cost Amount |

## Purchase Return Posting

Purchase return posting must reverse the accounting effect of purchase for returned goods and related tax, discount, freight, and other charges according to the approved business rule.

The return document should store its own totals and create a balanced accounting voucher.

For a posted purchase return:

| Dr / Cr | Account Code | Account Title | Amount |
| --- | --- | --- | --- |
| Dr | `0201010001` to `0201999999` | Supplier Payable - Supplier Name | Net Amount for Credit Purchase Return |
| Dr | `0101100101` | Cash In Hand | Net Amount for Cash Refund from supplier |
| Dr | `0502100501` | Purchase Discount Received | Discount Amount reversed |
| Cr | `0101300301` | Inventory Finished Goods | Gross Amount |
| Cr | `0101400301` | VAT Recoverable | Tax Amount |
| Cr | `0502100401` | Freight And Delivery | Freight Amount |
| Cr | Configured expense account | Other Purchase Charges | Other Charges |

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

For a posted sale return:

| Dr / Cr | Account Code | Account Title | Amount |
| --- | --- | --- | --- |
| Dr | `0401100101` | Sales Revenue | Gross Amount reversed |
| Dr | `0201300101` | Sales Tax Payable | Tax Amount reversed |
| Dr | `0401200101` | Freight Income | Freight Amount reversed |
| Dr | `0101300301` | Inventory Finished Goods | Cost Amount returned to stock |
| Cr | `0103010001` to `0103999999` | Customer Receivable - Customer Name | Net Amount for Credit Sale Return |
| Cr | `0101100101` | Cash In Hand | Net Amount for Cash Refund to customer |
| Cr | `0502200101` | Sales Discount Allowed | Discount Amount reversed |
| Cr | `0501100101` | Cost Of Goods Sold | Cost Amount reversed |

Sale return stock posting must create an `inventory_stock_movements` row with `quantity_in` and `movement_kind = SALE_RETURN`.

## Stock Adjustment Posting

Stock adjustment posting must create stock movement rows and a balanced accounting voucher when inventory value changes.

For Stock Adjustment Increase:

| Dr / Cr | Account Code | Account Title | Amount |
| --- | --- | --- | --- |
| Dr | `0101300301` | Inventory Finished Goods | Total Cost In |
| Cr | `0401300101` | Stock Adjustment Gain | Total Cost In |

For Stock Adjustment Decrease:

| Dr / Cr | Account Code | Account Title | Amount |
| --- | --- | --- | --- |
| Dr | `0502300101` | Stock Adjustment Loss | Total Cost Out |
| Cr | `0101300301` | Inventory Finished Goods | Total Cost Out |

For a mixed stock adjustment with both increases and decreases, post all needed lines in one voucher:

| Dr / Cr | Account Code | Account Title | Amount |
| --- | --- | --- | --- |
| Dr | `0101300301` | Inventory Finished Goods | Total Cost In |
| Cr | `0401300101` | Stock Adjustment Gain | Total Cost In |
| Dr | `0502300101` | Stock Adjustment Loss | Total Cost Out |
| Cr | `0101300301` | Inventory Finished Goods | Total Cost Out |

Rules:

- Increase lines must create `inventory_stock_movements.quantity_in`.
- Decrease lines must create `inventory_stock_movements.quantity_out`.
- The decrease cost must use the current stock valuation cost, not a user-entered sale or purchase price.
- Stock movement and accounting voucher posting must be in the same database transaction.

## Stock Transfer Posting

Stock Transfer moves stock between Warehouses or Locations. It does not normally create a Profit and Loss accounting voucher because total company inventory value does not change.

Stock Transfer must:

| Movement | Account Code | Account Title | Accounting Amount |
| --- | --- | --- | --- |
| Transfer Out | `0101300301` | Inventory Finished Goods | No voucher line, stock movement only |
| Transfer In | `0101300301` | Inventory Finished Goods | No voucher line, stock movement only |

Rules:

- Create `inventory_stock_movements` with `movement_kind = TRANSFER_OUT` for the source Warehouse or Location.
- Create `inventory_stock_movements` with `movement_kind = TRANSFER_IN` for the destination Warehouse or Location.
- Use the source stock valuation cost for both movement rows.
- Total stock quantity by company remains unchanged.
- Total stock value by company remains unchanged.
- If future branch accounting requires inter-branch clearing, add a separate approved rule using Branch In Transit or Inventory In Transit accounts. Do not add hidden accounting lines without a documented rule.

## Bank And Cash Posting

Bank and cash receipts/payments must create balanced accounting voucher lines.

| Voucher | Dr Account | Cr Account |
| --- | --- | --- |
| Bank Receipt | Bank linked ledger account from `bank_accounts.ledger_account_id` | Received-from Account |
| Bank Payment | Paid-to Account | Bank linked ledger account from `bank_accounts.ledger_account_id` |
| Cash Receipt | `0101100101` Cash In Hand | Received-from Account |
| Cash Payment | Paid-to Account | `0101100101` Cash In Hand |

Examples:

- Bank Receipt: Debit Bank, Credit received-from account.
- Bank Payment: Debit paid-to account, Credit Bank.
- Cash Receipt: Debit Cash, Credit received-from account.
- Cash Payment: Debit paid-to account, Credit Cash.

Cheque, clearing, bank, and deposit details belong in the business document tables. The accounting impact belongs in `vouchers` and `voucher_lines`.

## Journal Voucher Posting

Journal Voucher is manual accounting. It must use selected posting accounts exactly as entered by the user.

Rules:

- Every line must use a valid posting account.
- Store both account code and account title on every `voucher_lines` row.
- Total Debit must equal Total Credit.
- Journal Voucher should not be used to directly edit posted business documents.
- Corrections to posted business documents should use the approved correction workflow first: return, reversal, debit note, credit note, void, or adjustment.

## Debit Note And Credit Note Posting

Debit Note and Credit Note rules must identify the source business reason before posting.

Minimum account rule:

| Document | Dr Account | Cr Account |
| --- | --- | --- |
| Debit Note to Supplier | Supplier Payable or selected account | Purchase adjustment, expense recovery, or tax account |
| Credit Note from Supplier | Purchase adjustment, expense, or tax account | Supplier Payable or selected account |
| Debit Note to Customer | Customer Receivable or selected account | Sales adjustment, income, or tax account |
| Credit Note to Customer | Sales adjustment, discount, return, or tax account | Customer Receivable or selected account |

Do not implement generic Debit Note or Credit Note posting without a selected account, reason, and balanced voucher lines.

## Posting Safety

- Draft documents must not create ledger impact.
- Posted documents should not be edited directly.
- Corrections must use reversal, return, debit note, credit note, void, or adjustment workflows.
- Posting must run inside one database transaction.
- Posting must protect against duplicate posting in a multi-user environment.
- Stock movement and accounting voucher posting must succeed or fail together when the document affects both stock and accounts.
- Every posting screen must show a confirmation before final posting.
- Every accounting line must show or be traceable to Account Code and Account Title.
