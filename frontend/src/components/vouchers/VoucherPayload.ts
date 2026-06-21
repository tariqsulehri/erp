import { amountValue } from './VoucherShared';
import type { CashBankVoucherLine } from './CashBankVoucherLineTable';
import type { BankReceiptVoucherLine } from './BankReceiptVoucherLineTable';
import type { JournalVoucherLine } from './JournalVoucherLineTable';

export interface VoucherPayloadAccount {
  value: string;
  code: string;
  name: string;
}

export interface VoucherPayloadSelectOption {
  value: string;
  label: string;
}

export interface VoucherLinePayload {
  account_id: string;
  account_code: string;
  account_name: string;
  dr_amount: number;
  cr_amount: number;
  narration?: string;
  line_no: number;
}

export type VoucherPayloadBuildResult =
  | { ok: true; lines: VoucherLinePayload[] }
  | { ok: false; error: string };

interface CashBankPayloadConfig {
  direction: 'payment' | 'receipt';
  primaryAccountKind: 'Bank' | 'Cash';
  lineAccountLabel: string;
  showChequeFields: boolean;
  successNoun: string;
}

function findAccount(accounts: VoucherPayloadAccount[], accountId: string) {
  return accounts.find(option => option.value === accountId);
}

function cashBankLineNarration(line: CashBankVoucherLine, config: CashBankPayloadConfig, description: string) {
  return [
    line.description.trim(),
    config.showChequeFields && line.chequeDetails.trim() ? `Cheque Details ${line.chequeDetails.trim()}` : '',
    config.showChequeFields && line.chequeDate ? `Cheque Date ${line.chequeDate}` : '',
    config.showChequeFields && line.clearingDate ? `Clearing Date ${line.clearingDate}` : '',
  ].filter(Boolean).join(' | ') || description.trim() || config.successNoun;
}

export function buildCashBankVoucherLines({
  config,
  primaryAccountId,
  selectedPrimaryAccount,
  accountOptions,
  validLines,
  allLines,
  totalAmount,
  description,
}: {
  config: CashBankPayloadConfig;
  primaryAccountId: string;
  selectedPrimaryAccount: VoucherPayloadAccount;
  accountOptions: VoucherPayloadAccount[];
  validLines: CashBankVoucherLine[];
  allLines: CashBankVoucherLine[];
  totalAmount: number;
  description: string;
}): VoucherPayloadBuildResult {
  const voucherLines: VoucherLinePayload[] = [{
    account_id: primaryAccountId,
    account_code: selectedPrimaryAccount.code,
    account_name: selectedPrimaryAccount.name,
    dr_amount: config.direction === 'receipt' ? totalAmount : 0,
    cr_amount: config.direction === 'payment' ? totalAmount : 0,
    narration: description.trim() || config.successNoun,
    line_no: 1,
  }];

  for (const [index, line] of validLines.entries()) {
    const account = findAccount(accountOptions, line.accountId);
    if (!account) {
      const lineNumber = allLines.findIndex(item => item.id === line.id) + 1 || index + 1;
      return { ok: false, error: `${config.lineAccountLabel} was not found on line ${lineNumber}. Please select it again.` };
    }

    voucherLines.push({
      account_id: line.accountId,
      account_code: account.code,
      account_name: account.name,
      dr_amount: config.direction === 'payment' ? amountValue(line.amount) : 0,
      cr_amount: config.direction === 'receipt' ? amountValue(line.amount) : 0,
      narration: cashBankLineNarration(line, config, description),
      line_no: index + 2,
    });
  }

  return { ok: true, lines: voucherLines };
}

export function buildBankReceiptVoucherLines({
  bankAccountId,
  selectedBankAccount,
  accountOptions,
  depositTypes,
  validLines,
  allLines,
  totalAmount,
  description,
}: {
  bankAccountId: string;
  selectedBankAccount: VoucherPayloadAccount;
  accountOptions: VoucherPayloadAccount[];
  depositTypes: VoucherPayloadSelectOption[];
  validLines: BankReceiptVoucherLine[];
  allLines: BankReceiptVoucherLine[];
  totalAmount: number;
  description: string;
}): VoucherPayloadBuildResult {
  const voucherLines: VoucherLinePayload[] = [{
    account_id: bankAccountId,
    account_code: selectedBankAccount.code,
    account_name: selectedBankAccount.name,
    dr_amount: totalAmount,
    cr_amount: 0,
    narration: description || 'Bank Receipt',
    line_no: 1,
  }];

  for (const [index, line] of validLines.entries()) {
    const account = findAccount(accountOptions, line.receivedFromAccountId);
    if (!account) {
      const lineNumber = allLines.findIndex(item => item.id === line.id) + 1 || index + 1;
      return { ok: false, error: `Received From Account was not found on line ${lineNumber}. Please select it again.` };
    }

    const depositType = depositTypes.find(type => type.value === line.depositKind)?.label ?? 'Deposit';
    const lineDetails = [
      line.description,
      depositType,
      line.chequeNumber ? `Cheque ${line.chequeNumber}` : '',
      line.chequeDate ? `Cheque Date ${line.chequeDate}` : '',
    ].filter(Boolean).join(' | ');

    voucherLines.push({
      account_id: line.receivedFromAccountId,
      account_code: account.code,
      account_name: account.name,
      dr_amount: 0,
      cr_amount: amountValue(line.amount),
      narration: lineDetails || description || 'Bank Receipt',
      line_no: index + 2,
    });
  }

  return { ok: true, lines: voucherLines };
}

export function buildJournalVoucherLines({
  accountOptions,
  enteredLines,
  allLines,
  description,
}: {
  accountOptions: VoucherPayloadAccount[];
  enteredLines: JournalVoucherLine[];
  allLines: JournalVoucherLine[];
  description: string;
}): VoucherPayloadBuildResult {
  const voucherLines: VoucherLinePayload[] = [];

  for (const [index, line] of enteredLines.entries()) {
    const account = findAccount(accountOptions, line.accountId);
    if (!account) {
      const lineNumber = allLines.findIndex(item => item.id === line.id) + 1 || index + 1;
      return { ok: false, error: `Account was not found on line ${lineNumber}. Please select it again.` };
    }

    voucherLines.push({
      account_id: line.accountId,
      account_code: account.code,
      account_name: account.name,
      dr_amount: amountValue(line.debit),
      cr_amount: amountValue(line.credit),
      narration: line.description.trim() || description.trim(),
      line_no: index + 1,
    });
  }

  return { ok: true, lines: voucherLines };
}
