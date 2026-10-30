import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { dateOnlyText } from '../accounts/account-balance.js';
import type { AuthUser } from '../auth/access-rules.js';
import { DashboardKpiService } from '../dashboard/dashboard-kpi.service.js';
import { AgingReportService } from '../reports/aging-report.service.js';
import type {
  ExecutiveAiQueryResponse,
  ExecutiveAlertItem,
  ExecutiveBriefingResponse,
  ExecutiveMetricItem,
  ExecutiveSuggestionItem,
  ExecutiveTableData,
  MetricStatus,
} from './executive-ai.schema.js';

interface BankAccountBalanceRow {
  bank_name: string;
  account_title: string;
  account_number: string;
  account_code: string;
  balance: string;
}

interface ExpenseBreakdownRow {
  code: string;
  name: string;
  amount: string;
}

interface InventoryAlertRow {
  code: string;
  name: string;
  current_stock: string;
  min_stock_level: string;
  total_value: string;
}

interface DraftVoucherRow {
  voucher_no: string;
  voucher_type: string;
  voucher_date: string;
  total_amount: string;
  approval_status: string;
}

interface AgingRow {
  party_id: string;
  party_code: string;
  party_name: string;
  account_id: string;
  account_code: string;
  advance: string;
  balance: string;
  [key: string]: string | undefined;
}

function getBucketDecimal(record: Record<string, string | undefined>, key: string): Decimal {
  const raw = record[key];
  return new Decimal(raw && raw !== '' ? raw : 0);
}

export class ExecutiveAiService {
  constructor(
    private readonly companyId: string,
    private readonly actor: AuthUser
  ) {}

  private formatMoney(val: Decimal | number | string): string {
    const dec = new Decimal(val || 0);
    return dec.toNumber().toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Generates a complete executive pulse briefing derived 100% from live ledger and inventory tables.
   */
  async getExecutiveBriefing(): Promise<ExecutiveBriefingResponse> {
    const today = dateOnlyText(new Date());
    const kpiService = new DashboardKpiService(this.companyId);
    const agingService = new AgingReportService(this.companyId);

    const [kpis, arAgingRaw, apAgingRaw, draftAgg, pendingApprovalsCount, stockAlerts, dualControlRows] =
      await Promise.all([
        kpiService.kpis(),
        agingService.getAging({ kind: 'receivables', as_of_date: today }),
        agingService.getAging({ kind: 'payables', as_of_date: today }),
        prisma.voucher.aggregate({
          where: { companyId: this.companyId, status: 'Draft' },
          _count: { id: true },
          _sum: { totalDebit: true },
        }),
        prisma.voucher.count({
          where: { companyId: this.companyId, approvalStatus: 'Pending', status: 'Draft' },
        }),
        prisma.$queryRaw<Array<{ low_count: string; zero_count: string }>>`
          SELECT
            COUNT(*) FILTER (WHERE sb.current_stock <= i.min_stock_level)::text AS low_count,
            COUNT(*) FILTER (WHERE sb.current_stock <= 0)::text AS zero_count
          FROM inventory_stock_balances sb
          JOIN inventory_items i ON i.id = sb.item_id AND i.company_id = sb.company_id
          WHERE sb.company_id = CAST(${this.companyId} AS uuid) AND i.is_active = true
        `,
        prisma.$queryRaw<Array<{ total_posted: string; verified_count: string }>>`
          SELECT
            COUNT(*)::text AS total_posted,
            COUNT(*) FILTER (WHERE approval_status = 'Approved')::text AS verified_count
          FROM vouchers
          WHERE company_id = CAST(${this.companyId} AS uuid) AND status = 'Posted'
        `,
      ]);

    const arTotals = arAgingRaw.totals as Record<string, string>;
    const cashAndBankVal = new Decimal(kpis.position.cash_and_bank);
    const revenueVal = new Decimal(kpis.profit.revenue);
    const netProfitVal = new Decimal(kpis.profit.net_profit);
    const grossMarginVal = kpis.profit.gross_margin_percent ? parseFloat(kpis.profit.gross_margin_percent) : 0;
    const receivablesVal = new Decimal(kpis.position.receivables);
    const payablesVal = new Decimal(kpis.position.payables);
    const stockVal = new Decimal(kpis.position.stock_value);

    // Overdue receivables (> 30 days)
    const overdueAr = getBucketDecimal(arTotals, 'days_31_60')
      .plus(getBucketDecimal(arTotals, 'days_61_90'))
      .plus(getBucketDecimal(arTotals, 'over_90'));
    const overdueArRatio = receivablesVal.gt(0)
      ? overdueAr.div(receivablesVal).times(100).toFixed(1)
      : '0.0';

    // Governance: 4-Eyes dual control rate
    const totalPostedVouchers = parseInt(dualControlRows[0]?.total_posted ?? '0', 10);
    const verifiedVouchers = parseInt(dualControlRows[0]?.verified_count ?? '0', 10);
    const dualControlRate = totalPostedVouchers > 0
      ? Math.round((verifiedVouchers / totalPostedVouchers) * 100)
      : 100;

    const unpostedDraftsCount = draftAgg._count.id ?? 0;
    const unpostedDraftsTotal = new Decimal(draftAgg._sum.totalDebit ?? 0);
    const lowStockCount = parseInt(stockAlerts[0]?.low_count ?? '0', 10);
    const zeroStockCount = parseInt(stockAlerts[0]?.zero_count ?? '0', 10);

    // Multi-factor Health Score Algorithm (0 to 100)
    let healthScore = 70;
    // Liquidity: ratio of cash to payables
    if (payablesVal.gt(0)) {
      const quickRatio = cashAndBankVal.div(payablesVal).toNumber();
      if (quickRatio >= 1.2) healthScore += 10;
      else if (quickRatio < 0.6) healthScore -= 10;
    } else {
      healthScore += 5;
    }
    // Profitability
    if (netProfitVal.gt(0)) healthScore += 10;
    else if (netProfitVal.lt(0)) healthScore -= 15;

    // Overdue Debtors Risk
    const overduePctNum = parseFloat(overdueArRatio);
    if (overduePctNum > 40) healthScore -= 15;
    else if (overduePctNum < 15) healthScore += 5;

    // Governance Dual Control
    if (dualControlRate >= 85) healthScore += 5;
    else if (dualControlRate < 60) healthScore -= 5;

    // Unposted Drafts Backlog
    if (unpostedDraftsCount > 10) healthScore -= 5;

    // Bound between 10 and 100
    healthScore = Math.max(10, Math.min(100, Math.round(healthScore)));

    const healthStatus: MetricStatus =
      healthScore >= 80 ? 'optimal' : healthScore >= 60 ? 'warning' : 'critical';

    // Critical Alerts
    const criticalAlerts: ExecutiveAlertItem[] = [];
    if (parseFloat(overdueArRatio) > 25 && overdueAr.gt(0)) {
      criticalAlerts.push({
        id: 'alt-ar-overdue',
        level: 'warning',
        category: 'receivables',
        title: `Overdue Collections Alert (${overdueArRatio}%)`,
        detail: `${this.formatMoney(overdueAr)} in receivables has crossed the 30-day payment term. Prioritize follow-ups on delinquent accounts.`,
        actionLabel: 'Review Debtors Aging',
      });
    }

    if (zeroStockCount > 0) {
      criticalAlerts.push({
        id: 'alt-stock-out',
        level: 'critical',
        category: 'inventory',
        title: `${zeroStockCount} Product${zeroStockCount === 1 ? '' : 's'} Completely Out of Stock`,
        detail: 'Immediate stock replenishment is required to prevent customer order fulfillment blockages.',
        actionLabel: 'View Inventory Status',
      });
    }

    if (unpostedDraftsCount > 5) {
      criticalAlerts.push({
        id: 'alt-unposted-drafts',
        level: 'warning',
        category: 'governance',
        title: `${unpostedDraftsCount} Unposted Draft Vouchers Pending`,
        detail: `Draft vouchers totaling ${this.formatMoney(unpostedDraftsTotal)} are unposted and not yet reflected in general ledger statements.`,
        actionLabel: 'Review Vouchers',
      });
    }

    if (pendingApprovalsCount > 0) {
      criticalAlerts.push({
        id: 'alt-pending-approvals',
        level: 'warning',
        category: 'governance',
        title: `${pendingApprovalsCount} Approval Request${pendingApprovalsCount === 1 ? '' : 's'} Awaiting Maker-Checker Sign-off`,
        detail: 'Executive approval required to advance pending transactions.',
        actionLabel: 'Open Approvals',
      });
    }

    if (criticalAlerts.length === 0) {
      criticalAlerts.push({
        id: 'alt-healthy-ops',
        level: 'info',
        category: 'treasury',
        title: 'Operations & Controls Operating In Normal Range',
        detail: 'Working capital, liquidity buffer, inventory levels, and maker-checker dual controls conform to enterprise policy.',
      });
    }

    // Strategic Suggestions
    const strategicSuggestions = this.buildExecutiveSuggestions({
      cashAndBankVal,
      payablesVal,
      receivablesVal,
      overdueAr,
      overdueArRatio,
      netProfitVal,
      grossMarginVal,
      lowStockCount,
      zeroStockCount,
      unpostedDraftsCount,
      dualControlRate,
    });

    // Executive Summary Narrative
    const profitNarrative = netProfitVal.gt(0)
      ? `generating a positive Net Profit of ${this.formatMoney(netProfitVal)} with an operating Gross Margin of ${grossMarginVal.toFixed(1)}%`
      : netProfitVal.lt(0)
        ? `reflecting a net deficit of ${this.formatMoney(netProfitVal.abs())}, requiring active cost containment`
        : `at breakeven with revenue of ${this.formatMoney(revenueVal)}`;

    const liquidityNarrative = cashAndBankVal.gte(payablesVal)
      ? `Healthy liquidity cover with ${this.formatMoney(cashAndBankVal)} in cash and bank reserves vs ${this.formatMoney(payablesVal)} in total supplier payables.`
      : `Tight liquidity cover: cash holdings of ${this.formatMoney(cashAndBankVal)} against payables of ${this.formatMoney(payablesVal)}. Collections acceleration recommended.`;

    const summary = `Enterprise Financial Health is ${healthStatus.toUpperCase()} (Index: ${healthScore}/100). The organization is ${profitNarrative}. ${liquidityNarrative} Receivables stand at ${this.formatMoney(receivablesVal)} with ${overdueArRatio}% overdue, and inventory valuation sits at ${this.formatMoney(stockVal)}. Maker-Checker dual control verification stands at ${dualControlRate}%.`;

    return {
      generatedAt: new Date().toISOString(),
      healthScore,
      healthStatus,
      executiveSummary: summary,
      kpis: {
        cashAndBank: {
          label: 'Cash & Bank Reserves',
          value: this.formatMoney(cashAndBankVal),
          status: cashAndBankVal.gte(payablesVal) ? 'optimal' : 'warning',
          hint: 'Immediate liquid assets available across treasury accounts',
        },
        revenueYtd: {
          label: 'Revenue (YTD)',
          value: this.formatMoney(revenueVal),
          status: revenueVal.gt(0) ? 'optimal' : 'neutral',
          change: kpis.profit.revenue_change_percent,
        },
        netProfitYtd: {
          label: 'Net Profit (YTD)',
          value: this.formatMoney(netProfitVal),
          status: netProfitVal.gt(0) ? 'optimal' : netProfitVal.lt(0) ? 'critical' : 'neutral',
          change: kpis.profit.net_profit_change_percent,
        },
        grossMargin: {
          label: 'Gross Margin',
          value: `${grossMarginVal.toFixed(1)}%`,
          status: grossMarginVal >= 25 ? 'optimal' : grossMarginVal >= 10 ? 'warning' : 'critical',
          hint: 'Gross profit efficiency after Cost of Goods Sold',
        },
        receivables: {
          label: 'Total Receivables (AR)',
          value: this.formatMoney(receivablesVal),
          overdueAmount: this.formatMoney(overdueAr),
          overdueRatio: `${overdueArRatio}%`,
          status: parseFloat(overdueArRatio) < 20 ? 'optimal' : 'warning',
          hint: 'Total outstanding balances owed by customers',
        },
        payables: {
          label: 'Supplier Payables (AP)',
          value: this.formatMoney(payablesVal),
          status: 'neutral',
          hint: 'Current trade credit obligations due to suppliers',
        },
        stockValuation: {
          label: 'Inventory Valuation',
          value: this.formatMoney(stockVal),
          lowStockCount,
          zeroStockCount,
          status: zeroStockCount === 0 ? 'optimal' : 'warning',
          hint: 'Total valuation of warehouse and branch stock on hand',
        },
        internalControl: {
          unpostedVouchersCount: unpostedDraftsCount,
          unpostedVouchersTotal: this.formatMoney(unpostedDraftsTotal),
          dualControlRate,
          pendingApprovalsCount,
        },
      },
      criticalAlerts,
      strategicSuggestions,
    };
  }

  private buildExecutiveSuggestions(ctx: {
    cashAndBankVal: Decimal;
    payablesVal: Decimal;
    receivablesVal: Decimal;
    overdueAr: Decimal;
    overdueArRatio: string;
    netProfitVal: Decimal;
    grossMarginVal: number;
    lowStockCount: number;
    zeroStockCount: number;
    unpostedDraftsCount: number;
    dualControlRate: number;
  }): ExecutiveSuggestionItem[] {
    const list: ExecutiveSuggestionItem[] = [];

    if (parseFloat(ctx.overdueArRatio) > 20 && ctx.overdueAr.gt(0)) {
      list.push({
        id: 'sug-ar-collections',
        priority: 'high',
        category: 'collections',
        title: 'Accelerate Overdue Receivables Recovery',
        detail: `Overdue receivables account for ${ctx.overdueArRatio}% (${this.formatMoney(ctx.overdueAr)}) of total debtors. Establish structured collection follow-ups with top overdue accounts to immediately free up working capital.`,
        impact: `Potential cash injection of up to ${this.formatMoney(ctx.overdueAr)} into operating liquidity.`,
      });
    }

    if (ctx.cashAndBankVal.lt(ctx.payablesVal)) {
      list.push({
        id: 'sug-cash-cover',
        priority: 'high',
        category: 'liquidity',
        title: 'Optimize Supplier Payment Schedule & Working Capital',
        detail: `Current trade payables (${this.formatMoney(ctx.payablesVal)}) exceed liquid cash reserves (${this.formatMoney(ctx.cashAndBankVal)}). Negotiate phased payment terms with major suppliers while receivables are collected.`,
        impact: 'Avoids short-term liquidity bottlenecks and maintains vendor credit standing.',
      });
    }

    if (ctx.zeroStockCount > 0 || ctx.lowStockCount > 0) {
      list.push({
        id: 'sug-stock-reorder',
        priority: ctx.zeroStockCount > 0 ? 'high' : 'medium',
        category: 'inventory',
        title: 'Execute Targeted Stock Reordering',
        detail: `${ctx.zeroStockCount} items are out of stock and ${ctx.lowStockCount} are approaching minimum safety thresholds. Prioritize Purchase Vouchers for top-selling SKUs.`,
        impact: 'Eliminates revenue loss from unfulfilled sales orders.',
      });
    }

    if (ctx.unpostedDraftsCount > 5) {
      list.push({
        id: 'sug-clear-drafts',
        priority: 'medium',
        category: 'governance',
        title: 'Audit and Clear Unposted Draft Vouchers',
        detail: `${ctx.unpostedDraftsCount} draft vouchers are pending final posting. Ensure accounting staff review and post or cancel these drafts to keep management reports up to date.`,
        impact: 'Guarantees 100% ledger completeness and accurate financial statements.',
      });
    }

    if (ctx.dualControlRate < 80) {
      list.push({
        id: 'sug-strengthen-dual-control',
        priority: 'medium',
        category: 'governance',
        title: 'Reinforce 4-Eyes Maker-Checker Dual Control',
        detail: `Current dual-control rate is ${ctx.dualControlRate}%. Enforce voucher authorization workflow so transactions above threshold require independent approval before posting.`,
        impact: 'Mitigates fraud risk, prevents posting errors, and fulfills enterprise audit compliance.',
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'sug-scale-profitable',
        priority: 'low',
        category: 'liquidity',
        title: 'Reinvest Surplus Liquidity into High-Margin Inventory',
        detail: 'Cash reserves, collections ratio, and inventory turnover are balanced. Consider bulk procurement discounts on top-margin products to expand gross margin.',
        impact: 'Drives overall profitability without increasing operational risk.',
      });
    }

    return list;
  }

  /**
   * Executive NLP Query Engine: Dynamically answers CEO questions with real database figures.
   */
  async answerQuery(questionText: string): Promise<ExecutiveAiQueryResponse> {
    const q = questionText.toLowerCase().trim();

    // 1. LIQUIDITY & CASH
    if (
      q.includes('cash') ||
      q.includes('bank') ||
      q.includes('liquidity') ||
      q.includes('treasury') ||
      q.includes('funds') ||
      q.includes('cheque') ||
      q.includes('money')
    ) {
      return this.handleLiquidityQuery(questionText);
    }

    // 2. RECEIVABLES & DEBTORS
    if (
      q.includes('debtor') ||
      q.includes('receivable') ||
      q.includes('customer') ||
      q.includes('ar') ||
      q.includes('owe us') ||
      q.includes('overdue') ||
      q.includes('collect') ||
      q.includes('aging')
    ) {
      return this.handleReceivablesQuery(questionText);
    }

    // 3. PAYABLES & CREDITORS
    if (
      q.includes('payable') ||
      q.includes('creditor') ||
      q.includes('supplier') ||
      q.includes('vendor') ||
      q.includes('ap') ||
      q.includes('we owe') ||
      q.includes('bills')
    ) {
      return this.handlePayablesQuery(questionText);
    }

    // 4. PROFITABILITY & MARGINS
    if (
      q.includes('profit') ||
      q.includes('revenue') ||
      q.includes('loss') ||
      q.includes('income') ||
      q.includes('margin') ||
      q.includes('expense') ||
      q.includes('cost') ||
      q.includes('p&l') ||
      q.includes('financial performance')
    ) {
      return this.handleProfitabilityQuery(questionText);
    }

    // 5. INVENTORY & STOCK
    if (
      q.includes('stock') ||
      q.includes('inventory') ||
      q.includes('item') ||
      q.includes('sku') ||
      q.includes('warehouse') ||
      q.includes('valuation') ||
      q.includes('reorder') ||
      q.includes('out of stock')
    ) {
      return this.handleInventoryQuery(questionText);
    }

    // 6. GOVERNANCE, AUDIT & DUAL CONTROL
    if (
      q.includes('governance') ||
      q.includes('control') ||
      q.includes('approval') ||
      q.includes('audit') ||
      q.includes('draft') ||
      q.includes('maker') ||
      q.includes('checker') ||
      q.includes('4-eye') ||
      q.includes('four eye') ||
      q.includes('compliance') ||
      q.includes('unposted')
    ) {
      return this.handleGovernanceQuery(questionText);
    }

    // 7. STRATEGIC SUGGESTIONS & RECOMMENDATIONS
    if (
      q.includes('suggest') ||
      q.includes('recommend') ||
      q.includes('advice') ||
      q.includes('action') ||
      q.includes('strategy') ||
      q.includes('improve') ||
      q.includes('ceo')
    ) {
      return this.handleStrategicSuggestionsQuery(questionText);
    }

    // DEFAULT: GENERAL BUSINESS HEALTH & EXECUTIVE OVERVIEW
    return this.handleGeneralOverviewQuery(questionText);
  }

  private async handleLiquidityQuery(question: string): Promise<ExecutiveAiQueryResponse> {
    const kpiService = new DashboardKpiService(this.companyId);
    const kpis = await kpiService.kpis();
    const cashAndBankVal = new Decimal(kpis.position.cash_and_bank);
    const payablesVal = new Decimal(kpis.position.payables);

    // Query active bank accounts with real ledger balances
    const bankRows = await prisma.$queryRaw<BankAccountBalanceRow[]>`
      SELECT
        ba.bank_name,
        ba.account_title,
        ba.account_number,
        a.code AS account_code,
        (
          COALESCE(a.opening_balance, 0) +
          COALESCE((
            SELECT SUM(vl.dr_amount - vl.cr_amount)
            FROM voucher_lines vl
            JOIN vouchers v ON v.id = vl.voucher_id AND v.company_id = vl.company_id
            WHERE vl.account_id = a.id AND v.status = 'Posted' AND v.voucher_date <= CURRENT_DATE
          ), 0)
        )::text AS balance
      FROM bank_accounts ba
      JOIN accounts a ON a.id = ba.ledger_account_id AND a.company_id = ba.company_id
      WHERE ba.company_id = CAST(${this.companyId} AS uuid) AND ba.is_active = true
      ORDER BY a.code ASC
    `;

    const tableRows = bankRows.map(row => ({
      bank_name: row.bank_name,
      account_title: row.account_title,
      account_number: row.account_number,
      account_code: row.account_code,
      balance: this.formatMoney(row.balance),
    }));

    const status: MetricStatus = cashAndBankVal.gte(payablesVal) ? 'optimal' : 'warning';
    const coverageRatio = payablesVal.gt(0)
      ? cashAndBankVal.div(payablesVal).times(100).toFixed(1)
      : '100.0';

    const answer = `Total enterprise liquid reserves currently stand at **${this.formatMoney(cashAndBankVal)}** across bank and cash ledger accounts. Against total trade payables of **${this.formatMoney(payablesVal)}**, our immediate liquidity coverage ratio is **${coverageRatio}%**. ${
      cashAndBankVal.gte(payablesVal)
        ? 'Current reserves provide adequate working capital to cover short-term supplier obligations without external credit facility drawdowns.'
        : 'Cash holdings are below supplier payables; prioritizing collections on overdue customer accounts is recommended.'
    }`;

    return {
      question,
      intent: 'LIQUIDITY_AND_TREASURY',
      answer,
      status,
      keyMetrics: [
        { label: 'Total Liquid Funds', value: this.formatMoney(cashAndBankVal), status },
        { label: 'Trade Payables Due', value: this.formatMoney(payablesVal), status: 'neutral' },
        { label: 'Liquidity Coverage', value: `${coverageRatio}%`, status },
        { label: 'Active Bank Accounts', value: bankRows.length.toString(), status: 'neutral' },
      ],
      tableData: {
        title: 'Live Bank Accounts & Ledger Balances',
        columns: [
          { key: 'bank_name', label: 'Bank Name', align: 'left' },
          { key: 'account_title', label: 'Account Title', align: 'left' },
          { key: 'account_number', label: 'Account Number', align: 'left' },
          { key: 'account_code', label: 'GL Code', align: 'left' },
          { key: 'balance', label: 'Current Balance', align: 'right' },
        ],
        rows: tableRows,
      },
      actionableSuggestions: [
        'Review supplier payment dates to align payouts with anticipated customer receipts.',
        'Transfer surplus funds into yield-bearing or primary operating bank accounts.',
      ],
      followUpQuestions: [
        'Which customers owe us the most money right now?',
        'What are our total upcoming supplier payables?',
        'How does current revenue compare to last period?',
      ],
    };
  }

  private async handleReceivablesQuery(question: string): Promise<ExecutiveAiQueryResponse> {
    const today = dateOnlyText(new Date());
    const agingService = new AgingReportService(this.companyId);
    const arAgingRaw = await agingService.getAging({ kind: 'receivables', as_of_date: today });
    const arTotals = arAgingRaw.totals as Record<string, string>;

    const totalAr = new Decimal(arTotals.balance ?? 0);
    const currentAr = getBucketDecimal(arTotals, 'days_0_30');
    const overdue30_60 = getBucketDecimal(arTotals, 'days_31_60');
    const overdue60_90 = getBucketDecimal(arTotals, 'days_61_90');
    const overdue90Plus = getBucketDecimal(arTotals, 'over_90');
    const totalOverdue = overdue30_60.plus(overdue60_90).plus(overdue90Plus);
    const overduePct = totalAr.gt(0) ? totalOverdue.div(totalAr).times(100).toFixed(1) : '0.0';

    const rows = arAgingRaw.rows as unknown as AgingRow[];

    // Top 5 debtors with balance > 0
    const topDebtors = rows
      .filter(r => new Decimal(r.balance || 0).gt(0))
      .sort((a, b) => new Decimal(b.balance || 0).minus(new Decimal(a.balance || 0)).toNumber())
      .slice(0, 5)
      .map(r => {
        const debtorOverdue = getBucketDecimal(r, 'days_31_60')
          .plus(getBucketDecimal(r, 'days_61_90'))
          .plus(getBucketDecimal(r, 'over_90'));
        return {
          party_name: r.party_name,
          party_code: r.party_code,
          balance: this.formatMoney(r.balance),
          current: this.formatMoney(getBucketDecimal(r, 'days_0_30')),
          overdue: this.formatMoney(debtorOverdue),
        };
      });

    const status: MetricStatus = parseFloat(overduePct) < 20 ? 'optimal' : parseFloat(overduePct) < 40 ? 'warning' : 'critical';

    const answer = `Total outstanding Accounts Receivable (AR) is **${this.formatMoney(totalAr)}**. Of this, **${this.formatMoney(currentAr)}** is within standard 30-day terms, while **${this.formatMoney(totalOverdue)}** (${overduePct}%) is overdue beyond 30 days. ${
      parseFloat(overduePct) > 25
        ? `Delinquent collections represent a significant working capital lockup. Focus credit recovery teams on the top debtor accounts listed below.`
        : `Customer payment adherence is within acceptable corporate limits.`
    }`;

    return {
      question,
      intent: 'RECEIVABLES_AND_DEBTORS',
      answer,
      status,
      keyMetrics: [
        { label: 'Total Receivables', value: this.formatMoney(totalAr), status: 'neutral' },
        { label: 'Current (0-30 Days)', value: this.formatMoney(currentAr), status: 'optimal' },
        { label: 'Overdue (>30 Days)', value: this.formatMoney(totalOverdue), status },
        { label: 'Overdue Ratio', value: `${overduePct}%`, status },
      ],
      tableData: {
        title: 'Top Customer Accounts with Balances',
        columns: [
          { key: 'party_name', label: 'Customer Name', align: 'left' },
          { key: 'party_code', label: 'Code', align: 'left' },
          { key: 'balance', label: 'Total Balance', align: 'right' },
          { key: 'current', label: 'Current (0-30d)', align: 'right' },
          { key: 'overdue', label: 'Overdue (>30d)', align: 'right' },
        ],
        rows: topDebtors,
      },
      actionableSuggestions: [
        'Issue formal payment reminders to customers with balances older than 30 days.',
        'Place temporary credit hold on customer accounts exceeding 60 days overdue.',
      ],
      followUpQuestions: [
        'What is our current cash and bank balance?',
        'What are our top supplier payables?',
        'What is our overall business health score?',
      ],
    };
  }

  private async handlePayablesQuery(question: string): Promise<ExecutiveAiQueryResponse> {
    const today = dateOnlyText(new Date());
    const agingService = new AgingReportService(this.companyId);
    const apAgingRaw = await agingService.getAging({ kind: 'payables', as_of_date: today });
    const apTotals = apAgingRaw.totals as Record<string, string>;

    const totalAp = new Decimal(apTotals.balance ?? 0);
    const rows = apAgingRaw.rows as unknown as AgingRow[];

    const topSuppliers = rows
      .filter(r => new Decimal(r.balance || 0).gt(0))
      .sort((a, b) => new Decimal(b.balance || 0).minus(new Decimal(a.balance || 0)).toNumber())
      .slice(0, 5)
      .map(r => ({
        party_name: r.party_name,
        party_code: r.party_code,
        balance: this.formatMoney(r.balance),
        current: this.formatMoney(getBucketDecimal(r, 'days_0_30')),
        overdue: this.formatMoney(
          getBucketDecimal(r, 'days_31_60')
            .plus(getBucketDecimal(r, 'days_61_90'))
            .plus(getBucketDecimal(r, 'over_90'))
        ),
      }));

    const kpiService = new DashboardKpiService(this.companyId);
    const kpis = await kpiService.kpis();
    const cashAndBankVal = new Decimal(kpis.position.cash_and_bank);
    const isCovered = cashAndBankVal.gte(totalAp);

    const answer = `Total Accounts Payable (AP) due to trade suppliers is **${this.formatMoney(totalAp)}**. Current liquid cash reserves of **${this.formatMoney(cashAndBankVal)}** ${
      isCovered
        ? 'are sufficient to settle all outstanding vendor obligations without funding strain.'
        : `leave an operational shortfall of ${this.formatMoney(totalAp.minus(cashAndBankVal))}. Staggering settlement dates is advised.`
    }`;

    return {
      question,
      intent: 'PAYABLES_AND_CREDITORS',
      answer,
      status: isCovered ? 'optimal' : 'warning',
      keyMetrics: [
        { label: 'Total Supplier Payables', value: this.formatMoney(totalAp), status: 'neutral' },
        { label: 'Available Cash & Bank', value: this.formatMoney(cashAndBankVal), status: isCovered ? 'optimal' : 'warning' },
        { label: 'Creditors Count', value: topSuppliers.length.toString(), status: 'neutral' },
      ],
      tableData: {
        title: 'Top Suppliers & Outstanding Obligations',
        columns: [
          { key: 'party_name', label: 'Supplier Name', align: 'left' },
          { key: 'party_code', label: 'Code', align: 'left' },
          { key: 'balance', label: 'Balance Due', align: 'right' },
          { key: 'current', label: 'Current Terms', align: 'right' },
          { key: 'overdue', label: 'Overdue', align: 'right' },
        ],
        rows: topSuppliers,
      },
      actionableSuggestions: [
        'Schedule payment releases in batches aligned with incoming customer collections.',
        'Engage high-volume vendors for early payment settlement discounts.',
      ],
      followUpQuestions: [
        'How much cash do we have available in bank accounts?',
        'What are our total customer receivables?',
        'What are our top expense categories this fiscal year?',
      ],
    };
  }

  private async handleProfitabilityQuery(question: string): Promise<ExecutiveAiQueryResponse> {
    const kpiService = new DashboardKpiService(this.companyId);
    const kpis = await kpiService.kpis();

    const revenue = new Decimal(kpis.profit.revenue);
    const cogs = new Decimal(kpis.profit.cost_of_goods_sold);
    const grossProfit = new Decimal(kpis.profit.gross_profit);
    const netProfit = new Decimal(kpis.profit.net_profit);
    const grossMargin = kpis.profit.gross_margin_percent ?? '0.0';
    const netMargin = revenue.gt(0) ? netProfit.div(revenue).times(100).toFixed(1) : '0.0';

    // Top 5 operating expense accounts
    const expenseRows = await prisma.$queryRaw<ExpenseBreakdownRow[]>`
      SELECT
        a.code,
        a.name,
        COALESCE(SUM(vl.dr_amount - vl.cr_amount), 0)::text AS amount
      FROM voucher_lines vl
      JOIN vouchers v ON v.id = vl.voucher_id AND v.company_id = vl.company_id
      JOIN accounts a ON a.id = vl.account_id
      WHERE vl.company_id = CAST(${this.companyId} AS uuid)
        AND v.status = 'Posted'
        AND a.account_type = 'Expense'
        AND v.voucher_type <> 'CL'
      GROUP BY a.code, a.name
      HAVING SUM(vl.dr_amount - vl.cr_amount) > 0
      ORDER BY SUM(vl.dr_amount - vl.cr_amount) DESC
      LIMIT 5
    `;

    const tableRows = expenseRows.map(r => ({
      code: r.code,
      name: r.name,
      amount: this.formatMoney(r.amount),
    }));

    const status: MetricStatus = netProfit.gt(0) ? 'optimal' : netProfit.isZero() ? 'neutral' : 'critical';

    const answer = `For the active fiscal period, enterprise revenue reached **${this.formatMoney(revenue)}**, producing a Gross Profit of **${this.formatMoney(grossProfit)}** (Gross Margin: **${grossMargin}%**). Net Profit after operating expenses stands at **${this.formatMoney(netProfit)}** (Net Margin: **${netMargin}%**). ${
      netProfit.gt(0)
        ? 'Business operations remain fundamentally profitable with healthy unit margins.'
        : 'Net earnings are constrained by operating overhead; review top expense categories below for rationalization.'
    }`;

    return {
      question,
      intent: 'PROFITABILITY_AND_PERFORMANCE',
      answer,
      status,
      keyMetrics: [
        { label: 'Total Revenue', value: this.formatMoney(revenue), status: 'optimal', change: kpis.profit.revenue_change_percent },
        { label: 'Cost of Goods Sold', value: this.formatMoney(cogs), status: 'neutral' },
        { label: 'Gross Margin', value: `${grossMargin}%`, status: parseFloat(grossMargin) >= 20 ? 'optimal' : 'warning' },
        { label: 'Net Profit', value: this.formatMoney(netProfit), status, change: kpis.profit.net_profit_change_percent },
      ],
      tableData: {
        title: 'Top Operating Expense Accounts (YTD)',
        columns: [
          { key: 'code', label: 'GL Account Code', align: 'left' },
          { key: 'name', label: 'Expense Category', align: 'left' },
          { key: 'amount', label: 'Total Expense', align: 'right' },
        ],
        rows: tableRows,
      },
      actionableSuggestions: [
        'Review discretionary expense lines in the top 5 expense categories.',
        'Evaluate product pricing tiers to preserve gross margins against rising supply costs.',
      ],
      followUpQuestions: [
        'What is our current cash and bank position?',
        'Do we have inventory items running out of stock?',
        'Give me strategic suggestions to improve our margin.',
      ],
    };
  }

  private async handleInventoryQuery(question: string): Promise<ExecutiveAiQueryResponse> {
    const kpiService = new DashboardKpiService(this.companyId);
    const kpis = await kpiService.kpis();
    const stockVal = new Decimal(kpis.position.stock_value);

    // Critical inventory items (zero stock or below minimum level)
    const criticalItems = await prisma.$queryRaw<InventoryAlertRow[]>`
      SELECT
        i.code,
        i.name,
        sb.current_stock::text,
        i.min_stock_level::text,
        sb.total_stock_value::text AS total_value
      FROM inventory_stock_balances sb
      JOIN inventory_items i ON i.id = sb.item_id AND i.company_id = sb.company_id
      WHERE sb.company_id = CAST(${this.companyId} AS uuid)
        AND i.is_active = true
        AND (sb.current_stock <= i.min_stock_level OR sb.current_stock <= 0)
      ORDER BY sb.current_stock ASC
      LIMIT 8
    `;

    const outOfStockCount = criticalItems.filter(item => parseFloat(item.current_stock) <= 0).length;
    const lowStockCount = criticalItems.length;

    const tableRows = criticalItems.map(item => ({
      code: item.code,
      name: item.name,
      current_stock: parseFloat(item.current_stock).toFixed(0),
      min_stock_level: parseFloat(item.min_stock_level).toFixed(0),
      status: parseFloat(item.current_stock) <= 0 ? 'Out of Stock' : 'Below Safety Stock',
    }));

    const status: MetricStatus = outOfStockCount === 0 ? (lowStockCount === 0 ? 'optimal' : 'warning') : 'critical';

    const answer = `Total inventory valuation across all warehouses and branches is **${this.formatMoney(stockVal)}**. There are currently **${outOfStockCount}** items completely out of stock and **${lowStockCount}** items operating below their minimum safety stock threshold. Timely restocking of high-velocity SKUs is essential to avoid missed sales opportunities.`;

    return {
      question,
      intent: 'INVENTORY_AND_STOCK',
      answer,
      status,
      keyMetrics: [
        { label: 'Total Stock Valuation', value: this.formatMoney(stockVal), status: 'optimal' },
        { label: 'Out of Stock Items', value: outOfStockCount.toString(), status: outOfStockCount === 0 ? 'optimal' : 'critical' },
        { label: 'Below Minimum Stock', value: lowStockCount.toString(), status: lowStockCount === 0 ? 'optimal' : 'warning' },
      ],
      tableData: {
        title: 'Critical Inventory Alerts (Safety Stock & Stockouts)',
        columns: [
          { key: 'code', label: 'Item Code', align: 'left' },
          { key: 'name', label: 'Item Name', align: 'left' },
          { key: 'current_stock', label: 'Current Qty', align: 'right' },
          { key: 'min_stock_level', label: 'Safety Level', align: 'right' },
          { key: 'status', label: 'Alert Status', align: 'center' },
        ],
        rows: tableRows,
      },
      actionableSuggestions: [
        'Generate purchase requisitions for the out-of-stock items listed above.',
        'Review supplier lead times for critical SKU components.',
      ],
      followUpQuestions: [
        'What are our total customer sales and profit this year?',
        'What is our current cash position to fund purchases?',
        'Give me strategic suggestions to balance inventory and liquidity.',
      ],
    };
  }

  private async handleGovernanceQuery(question: string): Promise<ExecutiveAiQueryResponse> {
    const [draftAgg, pendingApprovalsCount, dualControlRows, draftRows] = await Promise.all([
      prisma.voucher.aggregate({
        where: { companyId: this.companyId, status: 'Draft' },
        _count: { id: true },
        _sum: { totalDebit: true },
      }),
      prisma.voucher.count({
        where: { companyId: this.companyId, approvalStatus: 'Pending', status: 'Draft' },
      }),
      prisma.$queryRaw<Array<{ total_posted: string; verified_count: string }>>`
        SELECT
          COUNT(*)::text AS total_posted,
          COUNT(*) FILTER (WHERE approval_status = 'Approved')::text AS verified_count
        FROM vouchers
        WHERE company_id = CAST(${this.companyId} AS uuid) AND status = 'Posted'
      `,
      prisma.$queryRaw<DraftVoucherRow[]>`
        SELECT
          voucher_no,
          voucher_type,
          voucher_date::text,
          total_debit::text AS total_amount,
          approval_status
        FROM vouchers
        WHERE company_id = CAST(${this.companyId} AS uuid) AND status = 'Draft'
        ORDER BY created_at DESC
        LIMIT 6
      `,
    ]);

    const totalPosted = parseInt(dualControlRows[0]?.total_posted ?? '0', 10);
    const verified = parseInt(dualControlRows[0]?.verified_count ?? '0', 10);
    const dualControlRate = totalPosted > 0 ? Math.round((verified / totalPosted) * 100) : 100;
    const draftCount = draftAgg._count.id ?? 0;
    const draftTotal = new Decimal(draftAgg._sum.totalDebit ?? 0);

    const tableRows = draftRows.map(v => ({
      voucher_no: v.voucher_no,
      voucher_type: v.voucher_type,
      voucher_date: v.voucher_date,
      total_amount: this.formatMoney(v.total_amount),
      approval_status: v.approval_status ?? 'Draft',
    }));

    const status: MetricStatus = dualControlRate >= 80 && draftCount <= 5 ? 'optimal' : 'warning';

    const answer = `Internal control audit telemetry confirms a **${dualControlRate}%** Maker-Checker dual control verification rate across all posted financial transactions. Currently, **${draftCount}** unposted draft vouchers totaling **${this.formatMoney(draftTotal)}** are in the pipeline, with **${pendingApprovalsCount}** awaiting executive authorization.`;

    return {
      question,
      intent: 'GOVERNANCE_AND_INTERNAL_CONTROL',
      answer,
      status,
      keyMetrics: [
        { label: 'Maker-Checker Compliance', value: `${dualControlRate}%`, status: dualControlRate >= 80 ? 'optimal' : 'warning' },
        { label: 'Unposted Draft Vouchers', value: draftCount.toString(), status: draftCount <= 5 ? 'optimal' : 'warning' },
        { label: 'Pending Approvals', value: pendingApprovalsCount.toString(), status: pendingApprovalsCount === 0 ? 'optimal' : 'warning' },
        { label: 'Draft Pipeline Value', value: this.formatMoney(draftTotal), status: 'neutral' },
      ],
      tableData: {
        title: 'Recent Draft & Pending Approval Vouchers',
        columns: [
          { key: 'voucher_no', label: 'Voucher No', align: 'left' },
          { key: 'voucher_type', label: 'Type', align: 'left' },
          { key: 'voucher_date', label: 'Date', align: 'left' },
          { key: 'total_amount', label: 'Amount', align: 'right' },
          { key: 'approval_status', label: 'Status', align: 'center' },
        ],
        rows: tableRows,
      },
      actionableSuggestions: [
        'Review and sign off on pending voucher approvals in the Approvals queue.',
        'Instruct financial staff to finalize or void unposted draft vouchers older than 7 days.',
      ],
      followUpQuestions: [
        'How is our overall business health?',
        'What is our current cash and bank balance?',
        'Which customer accounts are overdue?',
      ],
    };
  }

  private async handleStrategicSuggestionsQuery(question: string): Promise<ExecutiveAiQueryResponse> {
    const briefing = await this.getExecutiveBriefing();
    const suggestions = briefing.strategicSuggestions;

    const answer = `Based on live ledger, treasury, receivables aging, inventory valuations, and internal control telemetry, here are prioritized strategic actions for executive leadership:`;

    return {
      question,
      intent: 'STRATEGIC_RECOMMENDATIONS',
      answer,
      status: briefing.healthStatus,
      keyMetrics: [
        { label: 'Executive Health Score', value: `${briefing.healthScore}/100`, status: briefing.healthStatus },
        { label: 'Identified Priority Actions', value: suggestions.length.toString(), status: 'neutral' },
      ],
      actionableSuggestions: suggestions.map(s => `${s.title}: ${s.detail}`),
      followUpQuestions: [
        'How can we improve our cash flow and collections?',
        'What are our top supplier payables right now?',
        'Show me critical stock-out items that need reordering.',
      ],
    };
  }

  private async handleGeneralOverviewQuery(question: string): Promise<ExecutiveAiQueryResponse> {
    const briefing = await this.getExecutiveBriefing();
    const k = briefing.kpis;

    return {
      question,
      intent: 'EXECUTIVE_BUSINESS_OVERVIEW',
      answer: briefing.executiveSummary,
      status: briefing.healthStatus,
      keyMetrics: [
        { label: 'Executive Health Score', value: `${briefing.healthScore}/100`, status: briefing.healthStatus },
        { label: 'Cash & Bank Reserves', value: k.cashAndBank.value, status: k.cashAndBank.status },
        { label: 'Net Profit (YTD)', value: k.netProfitYtd.value, status: k.netProfitYtd.status },
        { label: 'Total Receivables (AR)', value: k.receivables.value, status: k.receivables.status },
        { label: 'Supplier Payables (AP)', value: k.payables.value, status: 'neutral' },
        { label: 'Stock Valuation', value: k.stockValuation.value, status: k.stockValuation.status },
      ],
      actionableSuggestions: briefing.strategicSuggestions.map(s => `${s.title}: ${s.detail}`),
      followUpQuestions: [
        'What is our detailed cash and bank balance?',
        'Which customers owe us overdue payments?',
        'What are our biggest expenses this fiscal year?',
        'Are any warehouse items running out of stock?',
      ],
    };
  }
}
