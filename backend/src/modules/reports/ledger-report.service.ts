import { Decimal } from 'decimal.js';
import { prisma } from '../../db/prisma.js';
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

function signedOpeningBalance(openingBalance: unknown, normalBalance: string) {
  const amount = new Decimal(String(openingBalance ?? '0'));
  return normalBalance === 'Credit' ? amount.negated() : amount;
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
    if (dateTo < dateFrom) throw businessError('Date To cannot be earlier than Date From.');

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

    const shouldIncludeOpeningBalance = !account.openingBalanceDate || account.openingBalanceDate <= dateFrom;
    const accountOpening = shouldIncludeOpeningBalance
      ? signedOpeningBalance(account.openingBalance, account.normalBalance)
      : new Decimal(0);

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
    const openingBalance = accountOpening.plus(previousDebit).minus(previousCredit);

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

    let runningBalance = openingBalance;
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    const reportLines = lines.map(line => {
      const debit = new Decimal(String(line.debitAmount ?? '0'));
      const credit = new Decimal(String(line.creditAmount ?? '0'));
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      runningBalance = runningBalance.plus(debit).minus(credit);

      return {
        id: line.id,
        voucher_id: line.voucherId,
        voucher_number: line.voucher.voucherNumber,
        voucher_type: line.voucher.voucherType,
        voucher_date: line.voucher.voucherDate,
        reference: line.voucher.reference,
        description: line.narration || line.voucher.narration || '',
        debit_amount: debit.toFixed(2),
        credit_amount: credit.toFixed(2),
        running_balance: runningBalance.abs().toFixed(2),
        running_balance_side: balanceSide(runningBalance),
        line_no: line.lineNo,
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
