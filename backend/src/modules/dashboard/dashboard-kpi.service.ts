import { Decimal } from 'decimal.js';
import { prisma } from '../../db/prisma.js';
import { dateOnlyText } from '../accounts/account-balance.js';

interface ResultRow {
  revenue: string;
  expenses: string;
  cost_of_goods_sold: string;
}

interface BalanceRow {
  receivables: string;
  payables: string;
  cash_and_bank: string;
}

function shiftYears(dateText: string, years: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return dateOnlyText(date);
}

function changePercent(current: Decimal, previous: Decimal) {
  if (previous.isZero()) return null;
  return current.minus(previous).div(previous.abs()).times(100).toDecimalPlaces(1).toFixed(1);
}

/**
 * Money figures for management, all from posted ledger entries (stock value from stock balances).
 * Profit figures cover the fiscal year up to today and compare with the same days of the year before.
 * Year-End Closing vouchers are left out so a closed year still shows its result.
 */
export class DashboardKpiService {
  constructor(private readonly companyId: string) {}

  private async resultFor(dateFrom: string, dateTo: string) {
    const rows = await prisma.$queryRaw<ResultRow[]>`
      SELECT
        COALESCE(SUM(vl.cr_amount - vl.dr_amount) FILTER (WHERE a.account_type = 'Revenue'), 0)::text AS revenue,
        COALESCE(SUM(vl.dr_amount - vl.cr_amount) FILTER (WHERE a.account_type = 'Expense'), 0)::text AS expenses,
        COALESCE(SUM(vl.dr_amount - vl.cr_amount) FILTER (
          WHERE a.id IN (SELECT cost_of_goods_sold_account_id FROM sale_settings WHERE company_id = CAST(${this.companyId} AS uuid))
        ), 0)::text AS cost_of_goods_sold
      FROM voucher_lines vl
      JOIN vouchers v ON v.id = vl.voucher_id AND v.company_id = vl.company_id
      JOIN accounts a ON a.id = vl.account_id
      WHERE vl.company_id = CAST(${this.companyId} AS uuid)
        AND v.status = 'Posted'
        AND v.voucher_type <> 'CL'
        AND v.voucher_date BETWEEN CAST(${dateFrom} AS date) AND CAST(${dateTo} AS date)
    `;
    const revenue = new Decimal(rows[0]?.revenue ?? 0);
    const expenses = new Decimal(rows[0]?.expenses ?? 0);
    const costOfGoodsSold = new Decimal(rows[0]?.cost_of_goods_sold ?? 0);
    return { revenue, expenses, costOfGoodsSold, grossProfit: revenue.minus(costOfGoodsSold), netProfit: revenue.minus(expenses) };
  }

  async kpis() {
    const todayText = dateOnlyText(new Date());
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        companyId: this.companyId,
        isDeleted: false,
        startDate: { lte: new Date(`${todayText}T00:00:00Z`) },
        endDate: { gte: new Date(`${todayText}T00:00:00Z`) },
      },
      orderBy: { startDate: 'desc' },
    });
    const periodFrom = fiscalYear ? dateOnlyText(fiscalYear.startDate) : `${todayText.slice(0, 4)}-01-01`;

    const [current, previous, balanceRows, stockRows] = await Promise.all([
      this.resultFor(periodFrom, todayText),
      this.resultFor(shiftYears(periodFrom, -1), shiftYears(todayText, -1)),
      prisma.$queryRaw<BalanceRow[]>`
        WITH balances AS (
          SELECT a.id,
                 (CASE WHEN a.normal_balance = 'Credit' THEN -COALESCE(a.opening_balance, 0) ELSE COALESCE(a.opening_balance, 0) END)
                 + COALESCE((
                     SELECT SUM(vl.dr_amount - vl.cr_amount)
                     FROM voucher_lines vl
                     JOIN vouchers v ON v.id = vl.voucher_id AND v.company_id = vl.company_id
                     WHERE vl.account_id = a.id AND v.status = 'Posted' AND v.voucher_date <= CURRENT_DATE
                   ), 0) AS debit_balance
          FROM accounts a
          WHERE a.company_id = CAST(${this.companyId} AS uuid) AND a.is_posting = true AND a.is_deleted = false
        ),
        cash_groups AS (
          SELECT DISTINCT LEFT(a.code, 6) AS prefix
          FROM accounts a
          WHERE a.id IN (
            SELECT default_cash_account_id FROM purchase_settings WHERE company_id = CAST(${this.companyId} AS uuid)
            UNION SELECT default_cash_account_id FROM sale_settings WHERE company_id = CAST(${this.companyId} AS uuid)
          )
        )
        SELECT
          COALESCE(SUM(b.debit_balance) FILTER (WHERE b.id IN (SELECT ar_account_id FROM customers WHERE company_id = CAST(${this.companyId} AS uuid))), 0)::text AS receivables,
          COALESCE(-SUM(b.debit_balance) FILTER (WHERE b.id IN (SELECT ap_account_id FROM suppliers WHERE company_id = CAST(${this.companyId} AS uuid))), 0)::text AS payables,
          COALESCE(SUM(b.debit_balance) FILTER (
            WHERE b.id IN (SELECT ledger_account_id FROM bank_accounts WHERE company_id = CAST(${this.companyId} AS uuid))
               OR b.id IN (SELECT a.id FROM accounts a JOIN cash_groups g ON LEFT(a.code, 6) = g.prefix
                           WHERE a.company_id = CAST(${this.companyId} AS uuid) AND a.account_type = 'Asset' AND a.is_posting = true)
          ), 0)::text AS cash_and_bank
        FROM balances b
      `,
      prisma.$queryRaw<Array<{ value: string }>>`
        SELECT COALESCE(SUM(total_stock_value), 0)::text AS value
        FROM inventory_stock_balances
        WHERE company_id = CAST(${this.companyId} AS uuid)
      `,
    ]);

    const money = (value: Decimal) => value.toFixed(2);
    const grossMargin = current.revenue.isZero() ? null : current.grossProfit.div(current.revenue).times(100).toFixed(1);

    return {
      period: { date_from: periodFrom, date_to: todayText, fiscal_year: fiscalYear?.fiscalYear ?? null },
      comparison_period: { date_from: shiftYears(periodFrom, -1), date_to: shiftYears(todayText, -1) },
      profit: {
        revenue: money(current.revenue),
        revenue_change_percent: changePercent(current.revenue, previous.revenue),
        cost_of_goods_sold: money(current.costOfGoodsSold),
        gross_profit: money(current.grossProfit),
        gross_margin_percent: grossMargin,
        net_profit: money(current.netProfit),
        net_profit_change_percent: changePercent(current.netProfit, previous.netProfit),
        previous_revenue: money(previous.revenue),
        previous_net_profit: money(previous.netProfit),
      },
      position: {
        receivables: money(new Decimal(balanceRows[0]?.receivables ?? 0)),
        payables: money(new Decimal(balanceRows[0]?.payables ?? 0)),
        cash_and_bank: money(new Decimal(balanceRows[0]?.cash_and_bank ?? 0)),
        stock_value: money(new Decimal(stockRows[0]?.value ?? 0)),
      },
    };
  }
}
