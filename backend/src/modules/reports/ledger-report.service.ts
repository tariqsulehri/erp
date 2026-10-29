import { Decimal } from 'decimal.js';
import { prisma } from '../../db/prisma.js';
import { openingBalanceForRange } from '../accounts/account-balance.js';
import type { LedgerReportQuery } from './ledger-report.schema.js';

function businessError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

function databaseDate(dateText: string) {
  const date = new Date(`${dateText}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw businessError('Report Date is not valid.');
  return date;
}

function decimalText(value: unknown) {
  return new Decimal(String(value ?? '0')).toFixed(2);
}

function balanceSide(balance: Decimal) {
  if (balance.gt(0)) return 'Debit';
  if (balance.lt(0)) return 'Credit';
  return 'Balanced';
}

export class LedgerReportService {
  constructor(private readonly companyId: string) {}

  async getAccountLedger(query: LedgerReportQuery) {
    const dateFrom = databaseDate(query.date_from);
    const dateTo = databaseDate(query.date_to);
    if (dateTo < dateFrom) throw businessError('Date To cannot be before Date From.');

    const account = await prisma.account.findFirst({
      where: {
        id: query.account_id,
        companyId: this.companyId,
        isDeleted: false,
      },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        normalBalance: true,
        isPosting: true,
        openingBalance: true,
        openingBalanceDate: true,
      },
    });

    if (!account) throw businessError('Account was not found.');
    if (!account.isPosting) throw businessError('Please select a Posting Account for Ledger Report.');

    const accountOpening = openingBalanceForRange(account, query.date_from, query.date_to);

    const previousTotals = await prisma.voucherLine.aggregate({
      where: {
        companyId: this.companyId,
        accountId: account.id,
        voucher: {
          companyId: this.companyId,
          status: 'Posted',
          voucherDate: { lt: dateFrom },
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const previousDebit = new Decimal(String(previousTotals._sum.debitAmount ?? '0'));
    const previousCredit = new Decimal(String(previousTotals._sum.creditAmount ?? '0'));
    const openingBalance = accountOpening.opening.plus(previousDebit).minus(previousCredit);

    const lines = await prisma.voucherLine.findMany({
      where: {
        companyId: this.companyId,
        accountId: account.id,
        voucher: {
          companyId: this.companyId,
          status: 'Posted',
          voucherDate: { gte: dateFrom, lte: dateTo },
        },
      },
      take: query.limit ?? 10000,
      include: {
        voucher: {
          select: {
            id: true,
            voucherNumber: true,
            voucherType: true,
            voucherDate: true,
            reference: true,
            narration: true,
            status: true,
          },
        },
      },
      orderBy: [
        { voucher: { voucherDate: 'asc' } },
        { voucher: { voucherNumber: 'asc' } },
        { lineNo: 'asc' },
        { id: 'asc' },
      ],
    });

    // An opening balance dated inside the report range is shown as its own row on that date.
    const openingRow = !accountOpening.periodDebit.isZero() || !accountOpening.periodCredit.isZero()
      ? {
          id: `opening-balance-${account.id}`,
          voucher_id: null,
          voucher_number: 'Opening Balance',
          voucher_type: 'OB',
          voucher_date: new Date(`${accountOpening.openingDateText}T00:00:00Z`),
          reference: null,
          description: 'Account Opening Balance',
          debit: accountOpening.periodDebit,
          credit: accountOpening.periodCredit,
          line_no: 0,
        }
      : null;
    const voucherRows = lines.map(line => ({
      id: line.id,
      voucher_id: line.voucherId as string | null,
      voucher_number: line.voucher.voucherNumber,
      voucher_type: line.voucher.voucherType,
      voucher_date: line.voucher.voucherDate,
      reference: line.voucher.reference,
      description: line.narration || line.voucher.narration || '',
      debit: new Decimal(String(line.debitAmount ?? '0')),
      credit: new Decimal(String(line.creditAmount ?? '0')),
      line_no: line.lineNo,
    }));
    const orderedRows = openingRow
      ? [
          ...voucherRows.filter(row => row.voucher_date < openingRow.voucher_date),
          openingRow,
          ...voucherRows.filter(row => row.voucher_date >= openingRow.voucher_date),
        ]
      : voucherRows;

    let runningBalance = openingBalance;
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    const reportLines = orderedRows.map(row => {
      totalDebit = totalDebit.plus(row.debit);
      totalCredit = totalCredit.plus(row.credit);
      runningBalance = runningBalance.plus(row.debit).minus(row.credit);

      return {
        id: row.id,
        voucher_id: row.voucher_id,
        voucher_number: row.voucher_number,
        voucher_type: row.voucher_type,
        voucher_date: row.voucher_date,
        reference: row.reference,
        description: row.description,
        debit_amount: row.debit.toFixed(2),
        credit_amount: row.credit.toFixed(2),
        running_balance: runningBalance.abs().toFixed(2),
        running_balance_side: balanceSide(runningBalance),
        line_no: row.line_no,
      };
    });

    const closingBalance = openingBalance.plus(totalDebit).minus(totalCredit);

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        account_type: account.accountType,
        normal_balance: account.normalBalance,
      },
      date_from: query.date_from,
      date_to: query.date_to,
      opening_balance: openingBalance.abs().toFixed(2),
      opening_balance_side: balanceSide(openingBalance),
      total_debit: decimalText(totalDebit),
      total_credit: decimalText(totalCredit),
      closing_balance: closingBalance.abs().toFixed(2),
      closing_balance_side: balanceSide(closingBalance),
      lines: reportLines,
    };
  }
}
