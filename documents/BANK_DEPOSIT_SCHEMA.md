# Bank Deposit Schema

This document explains the bank deposit tables in simple business language.

## Design Purpose

Bank deposit entry is a user-facing document. The user enters the bank, deposit date, deposit lines, cheque details, and amounts.

The accounting posting still belongs in the standard voucher tables:

- `vouchers`
- `voucher_lines`

When a bank deposit is posted, the system should:

- Debit the selected bank account for the total deposit amount.
- Credit each received-from account from the deposit lines.
- Keep draft deposits from affecting bank balance or ledger reports.
- Lock posted deposits and use reversal/void entries for corrections.

## Tables

| Table | Simple Description |
| --- | --- |
| `bank_accounts` | Company bank accounts that can receive or make payments. |
| `bank_deposit_types` | Configurable deposit types such as Cash, Cheque, Bank Transfer, and Other. |
| `bank_deposits` | Main bank deposit voucher header. |
| `bank_deposit_lines` | Deposit detail rows entered by the user. |

## `bank_accounts`

| Field | Description |
| --- | --- |
| `id` | Unique bank account record ID. |
| `company_id` | Company that owns this bank account. |
| `ledger_account_id` | Chart of accounts ledger account used for posting. |
| `bank_name` | Bank name. |
| `branch_name` | Branch name, if required. |
| `account_title` | Bank account title/name. |
| `account_number` | Bank account number. |
| `iban` | IBAN, if used. |
| `swift_code` | SWIFT code, if used. |
| `currency_code` | Currency for the bank account. |
| `opening_balance` | Starting balance entered during setup. |
| `opening_balance_date` | Date of the opening balance. |
| `is_default` | Marks the default bank account. |
| `notes` | Extra notes. |
| `is_active` | Active/inactive flag. |
| `created_by_id` | User who created the record. |
| `updated_by_id` | User who last updated the record. |
| `created_at` | Record creation time. |
| `updated_at` | Last update time. |

## `bank_deposit_types`

| Field | Description |
| --- | --- |
| `id` | Unique deposit type ID. |
| `company_id` | Company that owns this deposit type. |
| `code` | Short code such as `CASH` or `CHEQUE`. |
| `name` | User-facing name such as Cash Deposit. |
| `deposit_kind` | Reporting group: `CASH`, `CHEQUE`, `BANK_TRANSFER`, or `OTHER`. |
| `description` | Simple explanation of the deposit type. |
| `sort_order` | Display order in dropdowns. |
| `is_active` | Active/inactive flag. |
| `created_by_id` | User who created the record. |
| `updated_by_id` | User who last updated the record. |
| `created_at` | Record creation time. |
| `updated_at` | Last update time. |

## `bank_deposits`

| Field | Description |
| --- | --- |
| `id` | Unique bank deposit ID. |
| `company_id` | Company that owns this deposit. |
| `voucher_id` | Accounting voucher created when the deposit is posted. |
| `bank_account_id` | Bank account receiving the money. |
| `deposit_number` | User-facing deposit voucher number. |
| `deposit_date` | Deposit date. |
| `reference_number` | Optional reference number. |
| `description` | Main deposit description. |
| `status` | Draft, Posted, or Voided. |
| `cash_total` | Total cash amount. |
| `cheque_total` | Total cheque amount. |
| `transfer_total` | Total bank transfer amount. |
| `other_total` | Total other deposit amount. |
| `total_amount` | Total deposit amount. |
| `bank_balance_before` | Bank balance before posting, stored for audit. |
| `bank_balance_after` | Bank balance after posting, stored for audit. |
| `created_by_id` | User who created the deposit. |
| `updated_by_id` | User who last updated the deposit. |
| `posted_by_id` | User who posted the deposit. |
| `posted_at` | Posting time. |
| `voided_by_id` | User who voided the deposit. |
| `voided_at` | Void time. |
| `void_reason` | Reason for voiding. |
| `is_active` | Active/inactive flag. |
| `created_at` | Record creation time. |
| `updated_at` | Last update time. |

## `bank_deposit_lines`

| Field | Description |
| --- | --- |
| `id` | Unique deposit line ID. |
| `company_id` | Company that owns this line. |
| `bank_deposit_id` | Parent bank deposit. |
| `line_number` | Row number shown in the entry table. |
| `received_from_account_id` | Account credited by this line. |
| `received_from_account_code` | Account code snapshot for audit. |
| `received_from_account_name` | Account name snapshot for audit. |
| `deposit_type_id` | Selected deposit type. |
| `deposit_type_name` | Deposit type name snapshot for audit. |
| `description` | Line description. |
| `cheque_number` | Cheque number, if this is a cheque deposit. |
| `cheque_date` | Cheque date, if applicable. |
| `cheque_bank_name` | Bank name written on the cheque, if applicable. |
| `clearing_date` | Expected or actual clearing date. |
| `amount` | Deposit line amount. |
| `is_cleared` | Shows whether the line has cleared the bank. |
| `cleared_at` | Time when the line was marked cleared. |
| `is_active` | Active/inactive flag. |
| `created_at` | Record creation time. |
| `updated_at` | Last update time. |

## Important Rules

- One bank deposit should use one bank account.
- Use separate deposits for separate bank accounts.
- Do not show debit and credit fields to normal users on the bank deposit screen.
- Let the system create the debit and credit voucher lines during posting.
- Cheque deposits may stay uncleared until the clearing date is confirmed.
