import { Decimal } from 'decimal.js';
import { prisma } from '../../db/prisma.js';
import type { ProfitAndLossReportQuery } from './profit-and-loss-report.schema.js';

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

function hierarchyCodes(accountCode: string) {
  return {
    main_code: `${accountCode.slice(0, 2)}00000000`,
    group_code: `${accountCode.slice(0, 4)}000000`,
    sub_group_code: `${accountCode.slice(0, 6)}0000`,
  };
}

interface ProfitAndLossMovementRow {
  account_id: string;
  period_debit: string;
  period_credit: string;
}

export class ProfitAndLossReportService {
  constructor(private readonly companyId: string) {}

  async getProfitAndLoss(query: ProfitAndLossReportQuery) {
    const dateFrom = databaseDate(query.date_from);
    const dateTo = databaseDate(query.date_to);
    if (dateTo < dateFrom) throw businessError('Date To cannot be earlier than Date From.');

    const accounts = await prisma.account.findMany({
      where: {
        companyId: this.companyId,
        isDeleted: false,
        isPosting: true,
        OR: [
          { code: { startsWith: '04' } },
          { code: { startsWith: '05' } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        normalBalance: true,
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

    const movements = await prisma.$queryRaw<ProfitAndLossMovementRow[]>`
      SELECT
        vl.account_id::text,
        COALESCE(SUM(vl.dr_amount), 0)::text AS period_debit,
        COALESCE(SUM(vl.cr_amount), 0)::text AS period_credit
      FROM voucher_lines vl
      JOIN vouchers v ON v.id = vl.voucher_id
      WHERE vl.company_id = CAST(${this.companyId} AS uuid)
        AND v.company_id = CAST(${this.companyId} AS uuid)
        AND v.status = 'Posted'
        AND v.voucher_date >= CAST(${query.date_from} AS date)
        AND v.voucher_date <= CAST(${query.date_to} AS date)
      GROUP BY vl.account_id
    `;
    const movementMap = new Map(movements.map(row => [row.account_id, row]));

    let totalRevenue = new Decimal(0);
    let totalExpenses = new Decimal(0);

    const lines = accounts.map(account => {
      const movement = movementMap.get(account.id);
      const debit = new Decimal(movement?.period_debit ?? '0');
      const credit = new Decimal(movement?.period_credit ?? '0');
      const isRevenue = account.code.startsWith('04');
      const amount = isRevenue ? credit.minus(debit) : debit.minus(credit);
      if (isRevenue) totalRevenue = totalRevenue.plus(amount);
      else totalExpenses = totalExpenses.plus(amount);
      const codes = hierarchyCodes(account.code);

      return {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        account_type: account.accountType,
        normal_balance: account.normalBalance,
        section: isRevenue ? 'Revenue' : 'Expenses',
        ...codes,
        main_name: headerNameByCode.get(codes.main_code) ?? account.accountType,
        group_name: headerNameByCode.get(codes.group_code) ?? 'Other Accounts',
        sub_group_name: headerNameByCode.get(codes.sub_group_code) ?? 'Other Accounts',
        debit_amount: debit.toFixed(2),
        credit_amount: credit.toFixed(2),
        amount: amount.toFixed(2),
      };
    }).filter(line => query.include_zero_balances || !new Decimal(line.amount).isZero());

    const netProfit = totalRevenue.minus(totalExpenses);

    return {
      date_from: query.date_from,
      date_to: query.date_to,
      include_zero_balances: query.include_zero_balances,
      totals: {
        revenue: totalRevenue.toFixed(2),
        expenses: totalExpenses.toFixed(2),
        net_profit: netProfit.gt(0) ? netProfit.toFixed(2) : '0.00',
        net_loss: netProfit.lt(0) ? netProfit.abs().toFixed(2) : '0.00',
        result: netProfit.gt(0) ? 'Profit' : netProfit.lt(0) ? 'Loss' : 'Break Even',
      },
      lines,
    };
  }
}
