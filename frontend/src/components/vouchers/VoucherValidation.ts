import { amountValue, cleanAmount, friendlyErrorMessage, isValidDateInput, validAmountPattern } from './VoucherShared';
import type { CashBankVoucherLine } from './CashBankVoucherLineTable';
import type { BankReceiptVoucherLine } from './BankReceiptVoucherLineTable';
import type { JournalVoucherLine } from './JournalVoucherLineTable';

export interface VoucherAccountOption {
  value: string;
  label: string;
  code: string;
  name: string;
}

export interface VoucherSelectOption {
  value: string;
  label: string;
}

interface PostingDateValidationState {
  isFetching: boolean;
  error?: unknown;
  data?: {
    canPost?: boolean;
    reason?: string | null;
  } | null;
}

interface CashBankVoucherValidationConfig {
  dateLabel: string;
  primaryAccountLabel: string;
  primaryAccountKind: 'Bank' | 'Cash';
  lineAccountLabel: string;
  direction: 'payment' | 'receipt';
  showChequeFields: boolean;
  totalLabel: string;
}

function validatePostingDate({
  value,
  label,
  isValid,
  dateValidation,
}: {
  value: string;
  label: string;
  isValid: boolean;
  dateValidation: PostingDateValidationState;
}) {
  if (!value) return `${label} is required.`;
  if (!isValid) return `${label} is not a valid date.`;
  if (dateValidation.isFetching) return `${label} is still being checked. Please wait.`;
  if (dateValidation.error) {
    return friendlyErrorMessage(dateValidation.error, `Unable to check ${label}. Please refresh and try again.`);
  }
  if (dateValidation.data && !dateValidation.data.canPost) {
    return dateValidation.data.reason ?? `${label} is outside the open fiscal period.`;
  }
  return null;
}

function validateAutoReverseDate(autoReverseDate: string, voucherDate: string) {
  if (!autoReverseDate) return null;
  if (!isValidDateInput(autoReverseDate)) return 'Auto Reverse Date is not a valid date.';
  if (autoReverseDate <= voucherDate) return 'Auto Reverse Date must be after Voucher Date.';
  return null;
}

function validateAccountsReady({
  isLoading,
  error,
  accountCount,
}: {
  isLoading: boolean;
  error?: unknown;
  accountCount: number;
}) {
  if (isLoading) return 'Accounts are still loading. Please wait.';
  if (error) return friendlyErrorMessage(error, 'Unable to load accounts. Please refresh and try again.');
  if (accountCount === 0) return 'No active posting accounts were found. Please create accounts first.';
  return null;
}

function optionExists(options: VoucherSelectOption[], value: string) {
  return options.some(option => option.value === value);
}

function validateRequiredAmount(value: string, lineNumber: number, label = 'Amount') {
  const rawAmount = cleanAmount(value).trim();
  const amount = amountValue(value);
  if (!rawAmount || !validAmountPattern.test(rawAmount)) return `${label} must be a valid number on line ${lineNumber}.`;
  if (!Number.isFinite(amount) || amount <= 0) return `${label} must be greater than zero on line ${lineNumber}.`;
  return null;
}

function validateOptionalAmount(value: string, lineNumber: number, label: string) {
  const cleaned = cleanAmount(value).trim();
  if (!cleaned) return null;
  if (!validAmountPattern.test(cleaned)) return `${label} must be a valid number on line ${lineNumber}.`;
  if (amountValue(cleaned) <= 0) return `${label} must be greater than zero on line ${lineNumber}.`;
  return null;
}

export function validateCashBankVoucher({
  config,
  voucherDate,
  isVoucherDateValid,
  dateValidation,
  autoReverseDate,
  accountsLoading,
  accountsError,
  accountOptions,
  primaryAccountId,
  selectedPrimaryAccount,
  description,
  enteredLines,
  allLines,
  totalAmount,
}: {
  config: CashBankVoucherValidationConfig;
  voucherDate: string;
  isVoucherDateValid: boolean;
  dateValidation: PostingDateValidationState;
  autoReverseDate: string;
  accountsLoading: boolean;
  accountsError?: unknown;
  accountOptions: VoucherAccountOption[];
  primaryAccountId: string;
  selectedPrimaryAccount?: VoucherAccountOption;
  description: string;
  enteredLines: CashBankVoucherLine[];
  allLines: CashBankVoucherLine[];
  totalAmount: number;
}) {
  const dateError = validatePostingDate({
    value: voucherDate,
    label: config.dateLabel,
    isValid: isVoucherDateValid,
    dateValidation,
  });
  if (dateError) return dateError;

  const autoReverseError = validateAutoReverseDate(autoReverseDate, voucherDate);
  if (autoReverseError) return autoReverseError;

  const accountsErrorMessage = validateAccountsReady({
    isLoading: accountsLoading,
    error: accountsError,
    accountCount: accountOptions.length,
  });
  if (accountsErrorMessage) return accountsErrorMessage;

  if (!primaryAccountId) return `${config.primaryAccountLabel} is required.`;
  if (!selectedPrimaryAccount) return `${config.primaryAccountKind} Account was not found. Please select it again.`;
  if (!description.trim()) return 'Voucher Details is required.';
  if (enteredLines.length === 0) return `Add at least one ${config.direction === 'receipt' ? 'receipt' : 'payment'} line.`;

  const chequeKeys = new Set<string>();
  for (const [index, line] of enteredLines.entries()) {
    const lineNumber = allLines.findIndex(item => item.id === line.id) + 1 || index + 1;
    if (!line.accountId) return `${config.lineAccountLabel} is required on line ${lineNumber}.`;
    if (!optionExists(accountOptions, line.accountId)) {
      return `${config.lineAccountLabel} was not found on line ${lineNumber}. Please select it again.`;
    }
    if (line.accountId === primaryAccountId) {
      return `${config.lineAccountLabel} cannot be the selected ${config.primaryAccountKind} Account on line ${lineNumber}.`;
    }
    const amountError = validateRequiredAmount(line.amount, lineNumber);
    if (amountError) return amountError;

    if (config.showChequeFields) {
      if ((line.chequeDate || line.clearingDate) && !line.chequeDetails.trim()) {
        return `Cheque Details are required on line ${lineNumber}.`;
      }
      if (line.chequeDetails.trim() && !line.chequeDate) {
        return `Cheque Date is required on line ${lineNumber}.`;
      }
      if (line.clearingDate && line.chequeDate && line.clearingDate < line.chequeDate) {
        return `Clearing Date cannot be before Cheque Date on line ${lineNumber}.`;
      }
      if (line.chequeDetails.trim()) {
        const chequeKey = `${primaryAccountId.toLowerCase()}::${line.chequeDetails.trim().toLowerCase()}`;
        if (chequeKeys.has(chequeKey)) {
          return `Cheque Details ${line.chequeDetails.trim()} are already entered for this bank account.`;
        }
        chequeKeys.add(chequeKey);
      }
    }
  }

  if (totalAmount <= 0) return `${config.totalLabel} must be greater than zero.`;
  return null;
}

export function validateBankReceiptVoucher({
  depositDate,
  isDepositDateValid,
  dateValidation,
  accountsLoading,
  accountsError,
  accountOptions,
  bankAccountId,
  selectedBankAccount,
  enteredLines,
  validLines,
  allLines,
  totalAmount,
}: {
  depositDate: string;
  isDepositDateValid: boolean;
  dateValidation: PostingDateValidationState;
  accountsLoading: boolean;
  accountsError?: unknown;
  accountOptions: VoucherAccountOption[];
  bankAccountId: string;
  selectedBankAccount?: VoucherAccountOption;
  enteredLines: BankReceiptVoucherLine[];
  validLines: BankReceiptVoucherLine[];
  allLines: BankReceiptVoucherLine[];
  totalAmount: number;
}) {
  const dateError = validatePostingDate({
    value: depositDate,
    label: 'Deposit Date',
    isValid: isDepositDateValid,
    dateValidation,
  });
  if (dateError) return dateError;

  const accountsErrorMessage = validateAccountsReady({
    isLoading: accountsLoading,
    error: accountsError,
    accountCount: accountOptions.length,
  });
  if (accountsErrorMessage) return accountsErrorMessage;

  if (!bankAccountId) return 'Bank Account is required.';
  if (!selectedBankAccount) return 'Selected Bank Account was not found. Please select it again.';
  if (enteredLines.length === 0) return 'Add at least one receipt line.';

  for (const [index, line] of enteredLines.entries()) {
    const lineNumber = allLines.findIndex(item => item.id === line.id) + 1 || index + 1;
    if (!line.receivedFromAccountId) return `Received From Account is required on line ${lineNumber}.`;
    if (!optionExists(accountOptions, line.receivedFromAccountId)) {
      return `Received From Account was not found on line ${lineNumber}. Please select it again.`;
    }
    if (line.receivedFromAccountId === bankAccountId) return `Received From Account cannot be the selected Bank Account on line ${lineNumber}.`;

    const amountError = validateRequiredAmount(line.amount, lineNumber);
    if (amountError) return amountError;
  }

  if (totalAmount <= 0) return 'Total Deposit must be greater than zero.';

  const chequeKeys = new Set<string>();
  for (const line of validLines) {
    const lineNumber = allLines.findIndex(item => item.id === line.id) + 1;
    if (line.depositKind !== 'CHEQUE') continue;
    const chequeNumber = line.chequeNumber.trim();
    const chequeBankName = line.chequeBankName.trim();
    if (!chequeNumber) return `Cheque Number is required on line ${lineNumber}.`;
    if (!line.chequeDate) return `Cheque Date is required on line ${lineNumber}.`;
    if (!chequeBankName) return `Cheque Bank is required on line ${lineNumber}.`;
    if (line.clearingDate && line.clearingDate < line.chequeDate) {
      return `Clearing Date cannot be before Cheque Date on line ${lineNumber}.`;
    }
    const chequeKey = `${chequeBankName.toLowerCase()}::${chequeNumber.toLowerCase()}`;
    if (chequeKeys.has(chequeKey)) {
      return `Cheque Number ${chequeNumber} from ${chequeBankName} is already entered in this voucher.`;
    }
    chequeKeys.add(chequeKey);
  }

  return null;
}

export function validateJournalVoucher({
  voucherDate,
  isVoucherDateValid,
  dateValidation,
  autoReverseDate,
  accountsLoading,
  accountsError,
  accountOptions,
  description,
  enteredLines,
  allLines,
  totalDebit,
  totalCredit,
  isBalanced,
  outOfBalanceText,
}: {
  voucherDate: string;
  isVoucherDateValid: boolean;
  dateValidation: PostingDateValidationState;
  autoReverseDate: string;
  accountsLoading: boolean;
  accountsError?: unknown;
  accountOptions: VoucherAccountOption[];
  description: string;
  enteredLines: JournalVoucherLine[];
  allLines: JournalVoucherLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  outOfBalanceText: string;
}) {
  const dateError = validatePostingDate({
    value: voucherDate,
    label: 'Voucher Date',
    isValid: isVoucherDateValid,
    dateValidation,
  });
  if (dateError) return dateError;

  const autoReverseError = validateAutoReverseDate(autoReverseDate, voucherDate);
  if (autoReverseError) return autoReverseError;

  const accountsErrorMessage = validateAccountsReady({
    isLoading: accountsLoading,
    error: accountsError,
    accountCount: accountOptions.length,
  });
  if (accountsErrorMessage) return accountsErrorMessage;

  if (!description.trim()) return 'Voucher Details is required.';
  if (enteredLines.length < 2) return 'Add at least two journal lines.';

  for (const [index, line] of enteredLines.entries()) {
    const lineNumber = allLines.findIndex(item => item.id === line.id) + 1 || index + 1;
    const debit = amountValue(line.debit);
    const credit = amountValue(line.credit);
    if (!line.accountId) return `Account is required on line ${lineNumber}.`;
    if (!optionExists(accountOptions, line.accountId)) {
      return `Account was not found on line ${lineNumber}. Please select it again.`;
    }
    if (debit <= 0 && credit <= 0) return `Debit or Credit amount is required on line ${lineNumber}.`;
    if (debit > 0 && credit > 0) return `Line ${lineNumber} cannot have both Debit and Credit amounts.`;

    const debitError = validateOptionalAmount(line.debit, lineNumber, 'Debit');
    if (debitError) return debitError;
    const creditError = validateOptionalAmount(line.credit, lineNumber, 'Credit');
    if (creditError) return creditError;
  }

  if (totalDebit <= 0) return 'Total Debit must be greater than zero.';
  if (totalCredit <= 0) return 'Total Credit must be greater than zero.';
  if (!isBalanced) return `Journal Voucher is out of balance by ${outOfBalanceText}.`;
  return null;
}
