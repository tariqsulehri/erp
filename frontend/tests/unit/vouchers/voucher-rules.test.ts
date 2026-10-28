import { buildCashBankVoucherLines, buildJournalVoucherLines } from '@/components/vouchers/VoucherPayload';
import { validateCashBankVoucher, validateJournalVoucher } from '@/components/vouchers/VoucherValidation';
import type { CashBankVoucherLine } from '@/components/vouchers/CashBankVoucherLineTable';
import type { JournalVoucherLine } from '@/components/vouchers/JournalVoucherLineTable';

const accounts = [
  { value: 'cash', label: '0101100101 - Cash In Hand', code: '0101100101', name: 'Cash In Hand' },
  { value: 'rent', label: '0502100101 - Rent', code: '0502100101', name: 'Rent' },
  { value: 'sales', label: '0401100101 - Sales', code: '0401100101', name: 'Sales' },
];
const openDate = { isFetching: false, data: { canPost: true } };

const journalLine = (id: number, accountId: string, debit: string, credit: string): JournalVoucherLine => ({ id, accountId, description: '', debit, credit });
const cashLine = (id: number, accountId: string, amount: string, extra: Partial<CashBankVoucherLine> = {}): CashBankVoucherLine => ({
  id, accountId, description: '', chequeDetails: '', chequeDate: '', clearingDate: '', amount, ...extra,
});

function journal(lines: JournalVoucherLine[], overrides: Partial<Parameters<typeof validateJournalVoucher>[0]> = {}) {
  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  return validateJournalVoucher({
    voucherDate: '2026-10-01', isVoucherDateValid: true, dateValidation: openDate,
    accountsLoading: false, accountOptions: accounts, description: '',
    enteredLines: lines, allLines: lines, totalDebit, totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.005, outOfBalanceText: (totalDebit - totalCredit).toFixed(2),
    ...overrides,
  });
}

describe('Journal Voucher rules', () => {
  it('accepts a balanced voucher', () => {
    expect(journal([journalLine(1, 'rent', '100', ''), journalLine(2, 'cash', '', '100')])).toBeNull();
  });

  it('refuses an unbalanced voucher and states the difference', () => {
    expect(journal([journalLine(1, 'rent', '100', ''), journalLine(2, 'cash', '', '90')]))
      .toBe('Debit and Credit do not match. The difference is 10.00.');
  });

  it('needs two lines, an account and one amount per line', () => {
    expect(journal([journalLine(1, 'rent', '100', '')])).toBe('Add at least two journal lines.');
    expect(journal([journalLine(1, '', '100', ''), journalLine(2, 'cash', '', '100')])).toBe('Account is required on line 1.');
    expect(journal([journalLine(1, 'rent', '', ''), journalLine(2, 'cash', '', '100')])).toBe('Enter a Debit or a Credit amount on line 1.');
    expect(journal([journalLine(1, 'rent', '100', '5'), journalLine(2, 'cash', '', '95')])).toBe('Line 1 has both Debit and Credit. Enter only one.');
    expect(journal([journalLine(1, 'gone', '100', ''), journalLine(2, 'cash', '', '100')])).toBe('Account was not found on line 1. Select it again.');
  });

  it('refuses amounts with more than two decimals', () => {
    expect(journal([journalLine(1, 'rent', '10.555', ''), journalLine(2, 'cash', '', '10.555')])).toBe('Enter a correct number for Debit on line 1.');
  });

  it('checks the date first: missing, closed period, still checking', () => {
    const lines = [journalLine(1, 'rent', '100', ''), journalLine(2, 'cash', '', '100')];
    expect(journal(lines, { voucherDate: '' })).toBe('Voucher Date is required.');
    expect(journal(lines, { dateValidation: { isFetching: false, data: { canPost: false, reason: 'Period "October 2026" is closed.' } } }))
      .toBe('Period "October 2026" is closed.');
    expect(journal(lines, { dateValidation: { isFetching: true } })).toBe('Voucher Date is still being checked. Please wait.');
  });

  it('builds one debit-or-credit line per entry, numbered from 1, with the voucher details as default narration', () => {
    const lines = [journalLine(1, 'rent', '100', ''), { ...journalLine(2, 'cash', '', '100'), description: 'Paid in cash' }];
    expect(buildJournalVoucherLines({ accountOptions: accounts, enteredLines: lines, allLines: lines, description: 'October rent' })).toEqual({
      ok: true,
      lines: [
        { account_id: 'rent', account_code: '0502100101', account_name: 'Rent', dr_amount: 100, cr_amount: 0, narration: 'October rent', line_no: 1 },
        { account_id: 'cash', account_code: '0101100101', account_name: 'Cash In Hand', dr_amount: 0, cr_amount: 100, narration: 'Paid in cash', line_no: 2 },
      ],
    });
  });
});

describe('Cash and Bank Voucher rules', () => {
  const paymentConfig = {
    dateLabel: 'Voucher Date', primaryAccountLabel: 'Cash Account', primaryAccountKind: 'Cash' as const,
    lineAccountLabel: 'Paid To Account', direction: 'payment' as const, showChequeFields: false, totalLabel: 'Total Payment',
  };
  function cashPayment(lines: CashBankVoucherLine[], overrides: Partial<Parameters<typeof validateCashBankVoucher>[0]> = {}) {
    return validateCashBankVoucher({
      config: paymentConfig, voucherDate: '2026-10-01', isVoucherDateValid: true, dateValidation: openDate,
      accountsLoading: false, accountOptions: accounts, primaryAccountId: 'cash', selectedPrimaryAccount: accounts[0],
      description: 'Office rent', enteredLines: lines, allLines: lines,
      totalAmount: lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
      ...overrides,
    });
  }

  it('accepts a payment and refuses missing details, lines or a line paid to the cash account itself', () => {
    expect(cashPayment([cashLine(1, 'rent', '250')])).toBeNull();
    expect(cashPayment([cashLine(1, 'rent', '250')], { description: ' ' })).toBe('Voucher Details is required.');
    expect(cashPayment([])).toBe('Add at least one payment line.');
    expect(cashPayment([cashLine(1, 'cash', '250')])).toBe('Paid To Account cannot be the same as the Cash Account on line 1.');
    expect(cashPayment([cashLine(1, 'rent', '0')])).toBe('Amount must be more than zero on line 1.');
  });

  it('checks cheque details on bank vouchers, including the same cheque twice', () => {
    const bank = { ...paymentConfig, primaryAccountLabel: 'Bank Account', primaryAccountKind: 'Bank' as const, showChequeFields: true };
    const check = (lines: CashBankVoucherLine[]) => cashPayment(lines, { config: bank });
    expect(check([cashLine(1, 'rent', '10', { chequeDetails: 'CHQ-1' })])).toBe('Cheque Date is required on line 1.');
    expect(check([cashLine(1, 'rent', '10', { chequeDate: '2026-10-01' })])).toBe('Cheque Details are required on line 1.');
    expect(check([cashLine(1, 'rent', '10', { chequeDetails: 'CHQ-1', chequeDate: '2026-10-05', clearingDate: '2026-10-01' })]))
      .toBe('Clearing Date cannot be before Cheque Date on line 1.');
    expect(check([
      cashLine(1, 'rent', '10', { chequeDetails: 'CHQ-1', chequeDate: '2026-10-01' }),
      cashLine(2, 'sales', '10', { chequeDetails: 'chq-1', chequeDate: '2026-10-01' }),
    // Matched ignoring case; the message quotes the repeated line as typed.
    ])).toBe('Cheque Details chq-1 are already entered for this Bank Account.');
  });

  it('builds a payment as Cr cash for the total and Dr each line; a receipt the other way round', () => {
    const lines = [cashLine(1, 'rent', '250'), cashLine(2, 'sales', '50')];
    const base = { primaryAccountId: 'cash', selectedPrimaryAccount: accounts[0], accountOptions: accounts, validLines: lines, allLines: lines, totalAmount: 300, description: 'October' };
    const payment = buildCashBankVoucherLines({ ...base, config: { direction: 'payment', primaryAccountKind: 'Cash', lineAccountLabel: 'Paid To Account', showChequeFields: false, successNoun: 'Cash Payment' } });
    expect(payment.ok && payment.lines.map(line => [line.account_id, line.dr_amount, line.cr_amount, line.line_no])).toEqual([
      ['cash', 0, 300, 1], ['rent', 250, 0, 2], ['sales', 50, 0, 3],
    ]);
    const receipt = buildCashBankVoucherLines({ ...base, config: { direction: 'receipt', primaryAccountKind: 'Cash', lineAccountLabel: 'Received From Account', showChequeFields: false, successNoun: 'Cash Receipt' } });
    expect(receipt.ok && receipt.lines.map(line => [line.account_id, line.dr_amount, line.cr_amount])).toEqual([
      ['cash', 300, 0], ['rent', 0, 250], ['sales', 0, 50],
    ]);
    // The voucher always balances: total debit equals total credit.
    for (const result of [payment, receipt]) {
      if (!result.ok) throw new Error(result.error);
      const debit = result.lines.reduce((sum, line) => sum + line.dr_amount, 0);
      const credit = result.lines.reduce((sum, line) => sum + line.cr_amount, 0);
      expect(debit).toBe(credit);
    }
  });
});
