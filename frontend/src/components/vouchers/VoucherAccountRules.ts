import type { AccountListItem } from '@/lib/api/accounts';

export interface VoucherAccountOption {
  value: string;
  label: string;
  searchText: string;
  code: string;
  name: string;
  openingBalance?: string | number | null;
  currentBalance?: string | number | null;
}

export interface VoucherBankAccountRow {
  ledger_account_id: string;
  ledger_account_code: string;
  ledger_account_name: string;
  current_balance?: string | number | null;
  bank_name?: string | null;
  account_title?: string | null;
  account_number?: string | null;
}

const cashAccountCodePrefixes = ['010101', '010110'];

export function isCashAccountCode(code: string) {
  return cashAccountCodePrefixes.some(prefix => code.startsWith(prefix));
}

export function accountToVoucherOption(account: AccountListItem): VoucherAccountOption {
  return {
    value: account.id,
    label: `${account.code} - ${account.name}`,
    searchText: `${account.code} ${account.name}`,
    code: account.code,
    name: account.name,
    openingBalance: account.opening_balance,
    currentBalance: account.current_balance,
  };
}

export function bankAccountToVoucherOption(bankAccount: VoucherBankAccountRow): VoucherAccountOption {
  const bankText = [bankAccount.bank_name, bankAccount.account_title, bankAccount.account_number]
    .filter(Boolean)
    .join(' - ');

  return {
    value: bankAccount.ledger_account_id,
    label: bankText
      ? `${bankAccount.ledger_account_code} - ${bankText}`
      : `${bankAccount.ledger_account_code} - ${bankAccount.ledger_account_name}`,
    searchText: [
      bankAccount.ledger_account_code,
      bankAccount.ledger_account_name,
      bankAccount.bank_name,
      bankAccount.account_title,
      bankAccount.account_number,
    ].filter(Boolean).join(' '),
    code: bankAccount.ledger_account_code,
    name: bankAccount.ledger_account_name,
    openingBalance: bankAccount.current_balance,
    currentBalance: bankAccount.current_balance,
  };
}

export function getCashAccountOptions(accounts: AccountListItem[]) {
  return accounts
    .filter(account => account.is_active && account.is_posting && account.account_type === 'Asset' && isCashAccountCode(account.code))
    .map(accountToVoucherOption);
}

export function getBankAccountOptions(bankAccounts: VoucherBankAccountRow[]) {
  return bankAccounts
    .filter(account => account.ledger_account_id && account.ledger_account_code && account.ledger_account_name)
    .map(bankAccountToVoucherOption);
}

export function getVoucherLineAccountOptions(accounts: AccountListItem[], bankAccounts: VoucherBankAccountRow[]) {
  const bankLedgerAccountIds = new Set(bankAccounts.map(account => account.ledger_account_id).filter(Boolean));

  return accounts
    .filter(account => (
      account.is_active &&
      account.is_posting &&
      !isCashAccountCode(account.code) &&
      !bankLedgerAccountIds.has(account.id)
    ))
    .map(accountToVoucherOption);
}
