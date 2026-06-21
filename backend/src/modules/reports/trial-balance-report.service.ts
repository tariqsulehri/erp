import { Decimal } from 'decimal.js';
import { prisma } from '../../db/prisma.js';
import type { TrialBalanceReportQuery } from './trial-balance-report.schema.js';

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

function signedOpeningBalance(openingBalance: unknown, normalBalance: string) {
  const amount = new Decimal(String(openingBalance ?? '0'));
  return normalBalance === 'Credit' ? amount.negated() : amount;
}

function debitAmount(balance: Decimal) {
  return balance.gt(0) ? balance.toFixed(2) : '0.00';
}

function creditAmount(balance: Decimal) {
  return balance.lt(0) ? balance.abs().toFixed(2) : '0.00';
}

interface MovementRow {
  account_id: string;
  debit_before: string;
  credit_before: string;
  period_debit: string;
  period_credit: string;
}

interface TrialBalanceAmountRow {
  opening_debit: string;
  opening_credit: string;
  period_debit: string;
  period_credit: string;
  closing_debit: string;
  closing_credit: string;
}

function isZeroAmountRow(row: TrialBalanceAmountRow) {
  return [
    row.opening_debit,
    row.opening_credit,
    row.period_debit,
    row.period_credit,
    row.closing_debit,
    row.closing_credit,
  ].every(value => new Decimal(value).isZero());
}

function hierarchyCodes(accountCode: string) {
  return {
    main_code: `${accountCode.slice(0, 2)}00000000`,
    group_code: `${accountCode.slice(0, 4)}000000`,
    sub_group_code: `${accountCode.slice(0, 6)}0000`,
  };
}

export class TrialBalanceReportService {
  constructor(private readonly companyId: string) {}

  async getTrialBalance(query: TrialBalanceReportQuery) {
    const dateTo = databaseDate(query.date_to);
    const dateFrom = query.date_from ? databaseDate(query.date_from) : new Date(dateTo.getFullYear(), 0, 1, 12);
    if (dateTo < dateFrom) throw businessError('Date To cannot be earlier than Date From.');

    const accounts = await prisma.account.findMany({
      where: {
        companyId: this.companyId,
        isDeleted: false,
        isPosting: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        normalBalance: true,
        openingBalance: true,
        openingBalanceDate: true,
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });
    const headerAccounts = await prisma.account.findMany({
      where: {
        companyId: this.companyId,
        isDeleted: false,
        isPosting: false,
      },
      select: {
        code: true,
        name: true,
      },
    });
    const headerNameByCode = new Map(headerAccounts.map(account => [account.code, account.name]));

    const movements = await prisma.$queryRaw<MovementRow[]>`
      SELECT
        vl.account_id::text,
        COALESCE(SUM(vl.dr_amount) FILTER (WHERE v.voucher_date < CAST(${dateFrom.toISOString().slice(0, 10)} AS date)), 0)::text AS debit_before,
        COALESCE(SUM(vl.cr_amount) FILTER (WHERE v.voucher_date < CAST(${dateFrom.toISOString().slice(0, 10)} AS date)), 0)::text AS credit_before,
        COALESCE(SUM(vl.dr_amount) FILTER (
          WHERE v.voucher_date >= CAST(${dateFrom.toISOString().slice(0, 10)} AS date)
            AND v.voucher_date <= CAST(${query.date_to} AS date)
        ), 0)::text AS period_debit,
        COALESCE(SUM(vl.cr_amount) FILTER (
          WHERE v.voucher_date >= CAST(${dateFrom.toISOString().slice(0, 10)} AS date)
            AND v.voucher_date <= CAST(${query.date_to} AS date)
        ), 0)::text AS period_credit
      FROM voucher_lines vl
      JOIN vouchers v ON v.id = vl.voucher_id
      WHERE vl.company_id = CAST(${this.companyId} AS uuid)
        AND v.company_id = CAST(${this.companyId} AS uuid)
        AND v.status = 'Posted'
        AND v.voucher_date <= CAST(${query.date_to} AS date)
      GROUP BY vl.account_id
    `;
    const movementMap = new Map(movements.map(row => [row.account_id, row]));

    let totalOpeningDebit = new Decimal(0);
    let totalOpeningCredit = new Decimal(0);
    let totalPeriodDebit = new Decimal(0);
    let totalPeriodCredit = new Decimal(0);
    let totalClosingDebit = new Decimal(0);
    let totalClosingCredit = new Decimal(0);

    const lines = accounts.map(account => {
      const movement = movementMap.get(account.id);
      const includeOpening = !account.openingBalanceDate || account.openingBalanceDate <= dateFrom;
      const baseOpening = includeOpening ? signedOpeningBalance(account.openingBalance, account.normalBalance) : new Decimal(0);
      const debitBefore = new Decimal(movement?.debit_before ?? '0');
      const creditBefore = new Decimal(movement?.credit_before ?? '0');
      const periodDebit = new Decimal(movement?.period_debit ?? '0');
      const periodCredit = new Decimal(movement?.period_credit ?? '0');
      const openingBalance = baseOpening.plus(debitBefore).minus(creditBefore);
      const closingBalance = openingBalance.plus(periodDebit).minus(periodCredit);

      const openingDebit = new Decimal(debitAmount(openingBalance));
      const openingCredit = new Decimal(creditAmount(openingBalance));
      const closingDebit = new Decimal(debitAmount(closingBalance));
      const closingCredit = new Decimal(creditAmount(closingBalance));

      totalOpeningDebit = totalOpeningDebit.plus(openingDebit);
      totalOpeningCredit = totalOpeningCredit.plus(openingCredit);
      totalPeriodDebit = totalPeriodDebit.plus(periodDebit);
      totalPeriodCredit = totalPeriodCredit.plus(periodCredit);
      totalClosingDebit = totalClosingDebit.plus(closingDebit);
      totalClosingCredit = totalClosingCredit.plus(closingCredit);

      return {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        account_type: account.accountType,
        normal_balance: account.normalBalance,
        ...hierarchyCodes(account.code),
        main_name: headerNameByCode.get(hierarchyCodes(account.code).main_code) ?? account.accountType,
        group_name: headerNameByCode.get(hierarchyCodes(account.code).group_code) ?? 'Other Accounts',
        sub_group_name: headerNameByCode.get(hierarchyCodes(account.code).sub_group_code) ?? 'Other Accounts',
        opening_debit: openingDebit.toFixed(2),
        opening_credit: openingCredit.toFixed(2),
        period_debit: periodDebit.toFixed(2),
        period_credit: periodCredit.toFixed(2),
        closing_debit: closingDebit.toFixed(2),
        closing_credit: closingCredit.toFixed(2),
      };
    }).filter(line => {
      if (query.include_zero_balances) return true;
      return !isZeroAmountRow(line);
    });

    return {
      date_from: dateFrom.toISOString().slice(0, 10),
      date_to: query.date_to,
      include_zero_balances: query.include_zero_balances,
      totals: {
        opening_debit: totalOpeningDebit.toFixed(2),
        opening_credit: totalOpeningCredit.toFixed(2),
        period_debit: totalPeriodDebit.toFixed(2),
        period_credit: totalPeriodCredit.toFixed(2),
        closing_debit: totalClosingDebit.toFixed(2),
        closing_credit: totalClosingCredit.toFixed(2),
        difference: totalClosingDebit.minus(totalClosingCredit).abs().toFixed(2),
      },
      lines,
    };
  }
}
