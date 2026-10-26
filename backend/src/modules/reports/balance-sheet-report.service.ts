import { Decimal } from 'decimal.js';
import { prisma } from '../../db/prisma.js';
import { dateOnlyText, openingBalanceAsOf, signedOpeningBalance } from '../accounts/account-balance.js';
import type { BalanceSheetReportQuery } from './balance-sheet-report.schema.js';

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

function toDateText(value: Date) {
  return dateOnlyText(value);
}

function hierarchyCodes(accountCode: string) {
  return {
    main_code: `${accountCode.slice(0, 2)}00000000`,
    group_code: `${accountCode.slice(0, 4)}000000`,
    sub_group_code: `${accountCode.slice(0, 6)}0000`,
  };
}

type BalanceSheetSection = 'Assets' | 'Liabilities' | 'Equity';

interface BalanceMovementRow {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
}

interface ProfitLossRow {
  current_debit: string;
  current_credit: string;
  prior_debit: string;
  prior_credit: string;
}

function sectionForCode(accountCode: string): BalanceSheetSection | null {
  if (accountCode.startsWith('01')) return 'Assets';
  if (accountCode.startsWith('02')) return 'Liabilities';
  if (accountCode.startsWith('03')) return 'Equity';
  return null;
}

function sectionAmount(balance: Decimal, section: BalanceSheetSection) {
  return section === 'Assets' ? balance : balance.negated();
}

export class BalanceSheetReportService {
  constructor(private readonly companyId: string) {}

  async getBalanceSheet(query: BalanceSheetReportQuery) {
    const asOfDate = databaseDate(query.as_of_date);

    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        companyId: this.companyId,
        isDeleted: false,
        startDate: { lte: asOfDate },
        endDate: { gte: asOfDate },
      },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        fiscalYear: true,
        startDate: true,
        endDate: true,
      },
    });
    const profitDateFrom = fiscalYear?.startDate ? toDateText(fiscalYear.startDate) : `${asOfDate.getFullYear()}-01-01`;

    const accounts = await prisma.account.findMany({
      where: {
        companyId: this.companyId,
        isDeleted: false,
        isPosting: true,
        OR: [
          { code: { startsWith: '01' } },
          { code: { startsWith: '02' } },
          { code: { startsWith: '03' } },
        ],
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

    const movements = await prisma.$queryRaw<BalanceMovementRow[]>`
      SELECT
        vl.account_id::text,
        COALESCE(SUM(vl.dr_amount), 0)::text AS debit_amount,
        COALESCE(SUM(vl.cr_amount), 0)::text AS credit_amount
      FROM voucher_lines vl
      JOIN vouchers v ON v.id = vl.voucher_id
      WHERE vl.company_id = CAST(${this.companyId} AS uuid)
        AND v.company_id = CAST(${this.companyId} AS uuid)
        AND v.status = 'Posted'
        AND v.voucher_date <= CAST(${query.as_of_date} AS date)
      GROUP BY vl.account_id
    `;
    const movementMap = new Map(movements.map(row => [row.account_id, row]));

    // Revenue and Expense results that are not yet closed into Retained Earnings. Closing vouchers are
    // included here, so a closed year nets to zero and its result appears only in Retained Earnings.
    const profitRows = await prisma.$queryRaw<ProfitLossRow[]>`
      SELECT
        COALESCE(SUM(vl.dr_amount) FILTER (WHERE v.voucher_date >= CAST(${profitDateFrom} AS date)), 0)::text AS current_debit,
        COALESCE(SUM(vl.cr_amount) FILTER (WHERE v.voucher_date >= CAST(${profitDateFrom} AS date)), 0)::text AS current_credit,
        COALESCE(SUM(vl.dr_amount) FILTER (WHERE v.voucher_date < CAST(${profitDateFrom} AS date)), 0)::text AS prior_debit,
        COALESCE(SUM(vl.cr_amount) FILTER (WHERE v.voucher_date < CAST(${profitDateFrom} AS date)), 0)::text AS prior_credit
      FROM voucher_lines vl
      JOIN vouchers v ON v.id = vl.voucher_id
      JOIN accounts a ON a.id = vl.account_id
      WHERE vl.company_id = CAST(${this.companyId} AS uuid)
        AND v.company_id = CAST(${this.companyId} AS uuid)
        AND a.company_id = CAST(${this.companyId} AS uuid)
        AND v.status = 'Posted'
        AND v.voucher_date <= CAST(${query.as_of_date} AS date)
        AND a.account_type IN ('Revenue', 'Expense')
    `;
    const profitRow = profitRows[0];
    let currentDebitBalance = new Decimal(profitRow?.current_debit ?? '0').minus(profitRow?.current_credit ?? '0');
    let priorDebitBalance = new Decimal(profitRow?.prior_debit ?? '0').minus(profitRow?.prior_credit ?? '0');

    const resultAccounts = await prisma.account.findMany({
      where: {
        companyId: this.companyId,
        isDeleted: false,
        isPosting: true,
        accountType: { in: ['Revenue', 'Expense'] },
        NOT: { openingBalance: 0 },
      },
      select: { openingBalance: true, normalBalance: true, openingBalanceDate: true },
    });
    for (const account of resultAccounts) {
      const openingDateText = account.openingBalanceDate ? toDateText(account.openingBalanceDate) : null;
      if (openingDateText && openingDateText > query.as_of_date) continue;
      const signed = signedOpeningBalance(account.openingBalance, account.normalBalance);
      if (openingDateText && openingDateText >= profitDateFrom) currentDebitBalance = currentDebitBalance.plus(signed);
      else priorDebitBalance = priorDebitBalance.plus(signed);
    }
    // A debit balance on Revenue and Expense together means a loss, so profit is its negative.
    const currentProfit = currentDebitBalance.negated();
    const unclosedPriorProfit = priorDebitBalance.negated();

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);
    let totalEquity = new Decimal(0);

    const lines = accounts.map(account => {
      const section = sectionForCode(account.code);
      if (!section) return null;

      const movement = movementMap.get(account.id);
      const baseOpening = openingBalanceAsOf(account, query.as_of_date);
      const balance = baseOpening
        .plus(movement?.debit_amount ?? '0')
        .minus(movement?.credit_amount ?? '0');
      const amount = sectionAmount(balance, section);

      if (section === 'Assets') totalAssets = totalAssets.plus(amount);
      if (section === 'Liabilities') totalLiabilities = totalLiabilities.plus(amount);
      if (section === 'Equity') totalEquity = totalEquity.plus(amount);

      const codes = hierarchyCodes(account.code);
      return {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        account_type: account.accountType,
        normal_balance: account.normalBalance,
        section,
        ...codes,
        main_name: headerNameByCode.get(codes.main_code) ?? section,
        group_name: headerNameByCode.get(codes.group_code) ?? 'Other Accounts',
        sub_group_name: headerNameByCode.get(codes.sub_group_code) ?? 'Other Accounts',
        debit_balance: balance.gt(0) ? balance.toFixed(2) : '0.00',
        credit_balance: balance.lt(0) ? balance.abs().toFixed(2) : '0.00',
        amount: amount.toFixed(2),
        is_system_line: false,
      };
    }).filter(line => {
      if (!line) return false;
      if (query.include_zero_balances) return true;
      return !new Decimal(line.amount).isZero();
    });

    if (!unclosedPriorProfit.isZero()) {
      totalEquity = totalEquity.plus(unclosedPriorProfit);
      lines.push({
        account_id: 'unclosed-prior-years-result',
        account_code: '3999999998',
        account_name: 'Retained Earnings (Prior Years Not Closed)',
        account_type: 'Equity',
        normal_balance: 'Credit',
        section: 'Equity',
        main_code: '0300000000',
        main_name: headerNameByCode.get('0300000000') ?? 'Equity',
        group_code: '0399000000',
        group_name: 'Current Year Result',
        sub_group_code: '0399990000',
        sub_group_name: 'Current Year Result',
        debit_balance: unclosedPriorProfit.lt(0) ? unclosedPriorProfit.abs().toFixed(2) : '0.00',
        credit_balance: unclosedPriorProfit.gt(0) ? unclosedPriorProfit.toFixed(2) : '0.00',
        amount: unclosedPriorProfit.toFixed(2),
        is_system_line: true,
      });
    }

    if (query.include_zero_balances || !currentProfit.isZero()) {
      totalEquity = totalEquity.plus(currentProfit);
      lines.push({
        account_id: 'current-year-result',
        account_code: '3999999999',
        account_name: currentProfit.gte(0) ? 'Current Year Profit' : 'Current Year Loss',
        account_type: 'Equity',
        normal_balance: 'Credit',
        section: 'Equity',
        main_code: '0300000000',
        main_name: headerNameByCode.get('0300000000') ?? 'Equity',
        group_code: '0399000000',
        group_name: 'Current Year Result',
        sub_group_code: '0399990000',
        sub_group_name: 'Current Year Result',
        debit_balance: currentProfit.lt(0) ? currentProfit.abs().toFixed(2) : '0.00',
        credit_balance: currentProfit.gt(0) ? currentProfit.toFixed(2) : '0.00',
        amount: currentProfit.toFixed(2),
        is_system_line: true,
      });
    }

    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
    const difference = totalAssets.minus(totalLiabilitiesAndEquity);

    return {
      as_of_date: query.as_of_date,
      fiscal_year: fiscalYear
        ? {
            id: fiscalYear.id,
            fiscal_year: fiscalYear.fiscalYear,
            start_date: toDateText(fiscalYear.startDate),
            end_date: toDateText(fiscalYear.endDate),
          }
        : null,
      include_zero_balances: query.include_zero_balances,
      totals: {
        assets: totalAssets.toFixed(2),
        liabilities: totalLiabilities.toFixed(2),
        equity: totalEquity.toFixed(2),
        liabilities_and_equity: totalLiabilitiesAndEquity.toFixed(2),
        difference: difference.toFixed(2),
        current_year_profit: currentProfit.gt(0) ? currentProfit.toFixed(2) : '0.00',
        current_year_loss: currentProfit.lt(0) ? currentProfit.abs().toFixed(2) : '0.00',
        result: currentProfit.gt(0) ? 'Profit' : currentProfit.lt(0) ? 'Loss' : 'Break Even',
      },
      lines,
    };
  }
}
