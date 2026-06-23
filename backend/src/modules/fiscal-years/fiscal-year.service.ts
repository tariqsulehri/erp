import type { FiscalPeriod, FiscalYear, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { closeFiscalYearSchema, createFiscalYearSchema } from './fiscal-year.schema.js';
import type { z } from 'zod';

type CreateFiscalYearInput = z.infer<typeof createFiscalYearSchema>;
type CloseFiscalYearInput = z.infer<typeof closeFiscalYearSchema>;
type ClosingIssueCheck = 'draft_vouchers' | 'unposted_documents';

interface ClosingCheck {
  key: string;
  label: string;
  status: 'Passed' | 'Failed' | 'Warning';
  count: number;
  message: string;
  blocking: boolean;
  details?: ClosingCheckDetail[];
}

interface ClosingCheckDetail {
  label: string;
  count: number;
  note?: string;
}

interface ClosingIssueRow {
  id: string;
  module_name: string;
  document_type: string;
  document_number: string;
  document_date: string | Date;
  party_name: string | null;
  amount: string | null;
  status: string;
  source_path: string | null;
}

const businessDraftDocuments = [
  { label: 'Purchase Invoices', tableName: 'purchase_invoices', dateColumn: 'purchase_date' },
  { label: 'Sales Invoices', tableName: 'sale_invoices', dateColumn: 'sale_date' },
  { label: 'Purchase Returns', tableName: 'purchase_returns', dateColumn: 'purchase_return_date' },
  { label: 'Sales Returns', tableName: 'sale_returns', dateColumn: 'sale_return_date' },
  { label: 'Stock Transfers', tableName: 'stock_transfers', dateColumn: 'transfer_date' },
  { label: 'Stock Adjustments', tableName: 'stock_adjustments', dateColumn: 'adjustment_date' },
  { label: 'Bank Deposits', tableName: 'bank_deposits', dateColumn: 'deposit_date' },
] as const;

const voucherTypeLabels: Record<string, string> = {
  BPV: 'Bank Payment Voucher',
  BRV: 'Bank Receipt Voucher',
  CN: 'Credit Note',
  CPV: 'Cash Payment Voucher',
  CRV: 'Cash Receipt Voucher',
  CV: 'Contra Voucher',
  DN: 'Debit Note',
  JV: 'Journal Voucher',
  PI: 'Purchase Invoice',
  PR: 'Purchase Return',
  SA: 'Stock Adjustment',
  SI: 'Sales Invoice',
  SR: 'Sales Return',
};

const voucherTypePaths: Record<string, string> = {
  BPV: '/vouchers/bank-payment',
  BRV: '/vouchers/bank-receipt',
  CPV: '/vouchers/cash-payment',
  CRV: '/vouchers/cash-receipt',
  JV: '/vouchers/journal',
};

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateText(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, value.getUTCDate()));
}

function endOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function mapFiscalYear(fiscalYear: FiscalYear) {
  return {
    id: fiscalYear.id,
    company_id: fiscalYear.companyId,
    fiscal_year: fiscalYear.fiscalYear,
    year_basis: fiscalYear.yearBasis,
    start_date: toDateText(fiscalYear.startDate),
    end_date: toDateText(fiscalYear.endDate),
    number_of_periods: fiscalYear.numberOfPeriods,
    period_type: fiscalYear.periodType,
    posting_cutoff_days: fiscalYear.postingCutoffDays,
    status: fiscalYear.status,
    is_active: fiscalYear.isActive,
    is_locked: fiscalYear.isLocked,
    locked_at: fiscalYear.lockedAt?.toISOString() ?? null,
    transaction_count: fiscalYear.transactionCount,
    total_debits: fiscalYear.totalDebits.toString(),
    total_credits: fiscalYear.totalCredits.toString(),
    notes: fiscalYear.notes,
    created_at: fiscalYear.createdAt.toISOString(),
    updated_at: fiscalYear.updatedAt.toISOString(),
  };
}

function mapFiscalPeriod(period: FiscalPeriod) {
  return {
    id: period.id,
    company_id: period.companyId,
    fiscal_year_id: period.fiscalYearId,
    period_number: period.periodNumber,
    period_name: period.periodName,
    start_date: toDateText(period.startDate),
    end_date: toDateText(period.endDate),
    status: period.status,
    is_open: period.isOpen,
    is_locked: period.isLocked,
    locked_at: period.lockedAt?.toISOString() ?? null,
    posting_cutoff_days: period.postingCutoffDays,
    transaction_count: period.transactionCount,
    total_debits: period.totalDebits.toString(),
    total_credits: period.totalCredits.toString(),
    notes: period.notes,
    created_at: period.createdAt.toISOString(),
    updated_at: period.updatedAt.toISOString(),
  };
}

export class FiscalYearService {
  constructor(private readonly companyId: string) {}

  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: Prisma.FiscalYearWhereInput = {
      companyId: this.companyId,
      isDeleted: false,
    };

    const [total, rows] = await prisma.$transaction([
      prisma.fiscalYear.count({ where }),
      prisma.fiscalYear.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { fiscalYear: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(mapFiscalYear),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async create(input: CreateFiscalYearInput) {
    const startDate = parseDateOnly(input.start_date);
    const endDate = parseDateOnly(input.end_date);
    if (startDate >= endDate) {
      throw businessError('Start Date must be before End Date.');
    }

    return prisma.$transaction(async tx => {
      const overlappingYear = await tx.fiscalYear.findFirst({
        where: {
          companyId: this.companyId,
          isDeleted: false,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      });
      if (overlappingYear) {
        throw businessError('Fiscal Year dates overlap with an existing Fiscal Year.');
      }

      await tx.fiscalYear.updateMany({
        where: { companyId: this.companyId, isDeleted: false, isActive: true },
        data: { isActive: false },
      });

      const fiscalYear = await tx.fiscalYear.create({
        data: {
          companyId: this.companyId,
          fiscalYear: input.fiscal_year,
          yearBasis: input.year_basis,
          startDate,
          endDate,
          numberOfPeriods: input.number_of_periods,
          periodType: 'monthly',
          postingCutoffDays: input.posting_cutoff_days,
          status: 'open',
          isActive: true,
          periods: {
            create: this.buildPeriods(startDate, endDate, input.number_of_periods, input.posting_cutoff_days),
          },
        },
        include: { periods: { orderBy: { periodNumber: 'asc' } } },
      });

      return {
        success: true,
        fiscal_year: mapFiscalYear(fiscalYear),
        periods: fiscalYear.periods.map(mapFiscalPeriod),
        message: 'Fiscal Year created successfully.',
      };
    });
  }

  async getPeriods(fiscalYearId: string) {
    await this.assertFiscalYearExists(fiscalYearId);
    const periods = await prisma.fiscalPeriod.findMany({
      where: {
        companyId: this.companyId,
        fiscalYearId,
        isDeleted: false,
      },
      orderBy: { periodNumber: 'asc' },
    });
    return periods.map(mapFiscalPeriod);
  }

  async preCloseCheck(fiscalYearId: string) {
    const fiscalYear = await this.assertFiscalYearExists(fiscalYearId);
    const checks = await this.buildPreCloseChecks(fiscalYear);
    const canClose = checks.every(check => !check.blocking || check.status === 'Passed');
    return {
      fiscal_year: mapFiscalYear(fiscalYear),
      can_close: canClose,
      checks,
      message: canClose
        ? 'Fiscal Year is ready to close.'
        : 'Fiscal Year cannot be closed until failed checks are resolved.',
    };
  }

  async closingIssues(fiscalYearId: string, check: ClosingIssueCheck, page: number, limit: number) {
    const fiscalYear = await this.assertFiscalYearExists(fiscalYearId);
    await this.assertClosingSchemaReady();

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;
    const result = check === 'draft_vouchers'
      ? await this.draftVoucherIssueRows(fiscalYear, skip, safeLimit)
      : await this.businessDraftIssueRows(fiscalYear, skip, safeLimit);

    return {
      check,
      fiscal_year: mapFiscalYear(fiscalYear),
      data: result.rows.map(row => ({
        id: row.id,
        module_name: row.module_name,
        document_type: row.document_type,
        document_number: row.document_number,
        document_date: row.document_date instanceof Date ? toDateText(row.document_date) : String(row.document_date),
        party_name: row.party_name,
        amount: row.amount,
        status: row.status,
        source_path: row.source_path,
      })),
      pagination: {
        total: result.total,
        page: safePage,
        limit: safeLimit,
        pages: Math.max(1, Math.ceil(result.total / safeLimit)),
      },
    };
  }

  async closeFiscalYear(fiscalYearId: string, input: CloseFiscalYearInput = {}) {
    const fiscalYear = await this.assertFiscalYearExists(fiscalYearId);
    const checks = await this.buildPreCloseChecks(fiscalYear);
    const failed = checks.filter(check => check.blocking && check.status !== 'Passed');
    if (failed.length > 0) {
      throw businessError(`Fiscal Year cannot be closed. ${failed[0].message}`);
    }

    const totals = await this.yearVoucherTotals(fiscalYear);
    await prisma.$transaction(async tx => {
      await tx.fiscalPeriod.updateMany({
        where: {
          companyId: this.companyId,
          fiscalYearId,
          isDeleted: false,
        },
        data: {
          isOpen: false,
          isLocked: true,
          status: 'closed',
          lockedAt: new Date(),
        },
      });

      await tx.fiscalYear.update({
        where: { id: fiscalYearId },
        data: {
          status: 'closed',
          isLocked: true,
          isActive: false,
          lockedAt: fiscalYear.lockedAt ?? new Date(),
          closingStartedAt: fiscalYear.closingStartedAt ?? new Date(),
          closingCompletedAt: new Date(),
          transactionCount: totals.transaction_count,
          totalDebits: totals.total_debit,
          totalCredits: totals.total_credit,
          notes: input.remarks?.trim() || fiscalYear.notes,
        },
      });
    });

    return {
      success: true,
      message: 'Fiscal Year closed successfully. You can now open the new Fiscal Year.',
      checks,
    };
  }

  async lockFiscalYear(fiscalYearId: string) {
    await this.assertFiscalYearExists(fiscalYearId);
    await prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: {
        isLocked: true,
        status: 'closing',
        lockedAt: new Date(),
        closingStartedAt: new Date(),
      },
    });
    return { success: true, message: 'Fiscal Year locked successfully.' };
  }

  async lockPeriod(periodId: string) {
    const period = await this.assertPeriodExists(periodId);
    if (period.status === 'closed') {
      throw businessError('Closed periods cannot be locked again.');
    }

    await prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        isOpen: false,
        isLocked: true,
        status: 'locked',
        lockedAt: new Date(),
      },
    });

    return { success: true, message: 'Fiscal Period locked successfully.' };
  }

  async closePeriod(periodId: string) {
    const period = await this.assertPeriodExists(periodId);
    const openCount = await prisma.fiscalPeriod.count({
      where: {
        companyId: this.companyId,
        fiscalYearId: period.fiscalYearId,
        isDeleted: false,
        isOpen: true,
      },
    });

    if (openCount <= 1 && period.isOpen) {
      throw businessError('Cannot close the last open period. At least one period must remain open.');
    }

    await prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        isOpen: false,
        isLocked: true,
        status: 'closed',
      },
    });

    return { success: true, message: 'Fiscal Period closed successfully.' };
  }

  private buildPeriods(startDate: Date, endDate: Date, numberOfPeriods: number, postingCutoffDays: number) {
    return Array.from({ length: numberOfPeriods }, (_, index) => {
      const periodStart = addMonths(startDate, index);
      const periodEnd = index === numberOfPeriods - 1 ? endDate : endOfMonth(periodStart);
      return {
        companyId: this.companyId,
        periodNumber: index + 1,
        periodName: `${monthNames[periodStart.getUTCMonth()]} ${periodStart.getUTCFullYear()}`,
        startDate: periodStart,
        endDate: periodEnd,
        status: 'open',
        isOpen: true,
        postingCutoffDays,
      };
    });
  }

  private async assertFiscalYearExists(fiscalYearId: string) {
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        id: fiscalYearId,
        companyId: this.companyId,
        isDeleted: false,
      },
    });
    if (!fiscalYear) {
      throw businessError('Fiscal Year was not found.', 404);
    }
    return fiscalYear;
  }

  private async buildPreCloseChecks(fiscalYear: FiscalYear): Promise<ClosingCheck[]> {
    const missingTables = await this.missingClosingTables([
      'vouchers',
      'voucher_lines',
      'bank_cheques',
      'bank_accounts',
      'customers',
      'suppliers',
      ...businessDraftDocuments.map(document => document.tableName),
    ]);

    if (missingTables.length > 0) {
      return [
        {
          key: 'fiscal_year_status',
          label: 'Fiscal Year Is Open',
          status: fiscalYear.status === 'closed' ? 'Failed' : 'Passed',
          count: fiscalYear.status === 'closed' ? 1 : 0,
          message: fiscalYear.status === 'closed' ? 'Fiscal Year is already closed.' : 'Fiscal Year is available for closing.',
          blocking: true,
        },
        {
          key: 'closing_tables',
          label: 'Closing Tables Available',
          status: 'Failed',
          count: missingTables.length,
          message: `Required closing table(s) not found: ${missingTables.join(', ')}. Please run database migrations before closing the Fiscal Year.`,
          blocking: true,
        },
      ];
    }

    const missingColumns = await this.missingClosingColumns([
      { tableName: 'vouchers', columnName: 'company_id' },
      { tableName: 'vouchers', columnName: 'voucher_date' },
      { tableName: 'vouchers', columnName: 'status' },
      { tableName: 'vouchers', columnName: 'total_debit' },
      { tableName: 'vouchers', columnName: 'total_credit' },
      { tableName: 'voucher_lines', columnName: 'company_id' },
      { tableName: 'voucher_lines', columnName: 'voucher_id' },
      { tableName: 'voucher_lines', columnName: 'dr_amount' },
      { tableName: 'voucher_lines', columnName: 'cr_amount' },
      { tableName: 'bank_cheques', columnName: 'company_id' },
      { tableName: 'bank_cheques', columnName: 'status' },
      { tableName: 'bank_cheques', columnName: 'issue_date' },
      { tableName: 'bank_cheques', columnName: 'created_at' },
      ...businessDraftDocuments.flatMap(document => [
        { tableName: document.tableName, columnName: 'company_id' },
        { tableName: document.tableName, columnName: document.dateColumn },
        { tableName: document.tableName, columnName: 'status' },
      ]),
    ]);

    if (missingColumns.length > 0) {
      return [
        {
          key: 'fiscal_year_status',
          label: 'Fiscal Year Is Open',
          status: fiscalYear.status === 'closed' ? 'Failed' : 'Passed',
          count: fiscalYear.status === 'closed' ? 1 : 0,
          message: fiscalYear.status === 'closed' ? 'Fiscal Year is already closed.' : 'Fiscal Year is available for closing.',
          blocking: true,
        },
        {
          key: 'closing_schema',
          label: 'Closing Schema Available',
          status: 'Failed',
          count: missingColumns.length,
          message: `Required closing column(s) not found: ${missingColumns.join(', ')}. Please run database migrations before closing the Fiscal Year.`,
          blocking: true,
        },
      ];
    }

    const [
      openPeriods,
      draftVouchers,
      unbalancedPostedVouchers,
      postedVoucherWithoutLines,
      businessDrafts,
      draftVoucherDetails,
      businessDraftDetails,
      unresolvedCheques,
      trialBalance,
    ] = await Promise.all([
      prisma.fiscalPeriod.count({
        where: {
          companyId: this.companyId,
          fiscalYearId: fiscalYear.id,
          isDeleted: false,
          status: { not: 'closed' },
        },
      }),
      this.countRows(`
        SELECT COUNT(*)::int AS count
        FROM vouchers
        WHERE company_id = CAST($1 AS uuid)
          AND voucher_date >= CAST($2 AS date)
          AND voucher_date <= CAST($3 AS date)
          AND status = 'Draft'
      `, fiscalYear),
      this.countRows(`
        SELECT COUNT(*)::int AS count
        FROM vouchers
        WHERE company_id = CAST($1 AS uuid)
          AND voucher_date >= CAST($2 AS date)
          AND voucher_date <= CAST($3 AS date)
          AND status = 'Posted'
          AND total_debit <> total_credit
      `, fiscalYear),
      this.countRows(`
        SELECT COUNT(*)::int AS count
        FROM vouchers v
        WHERE v.company_id = CAST($1 AS uuid)
          AND v.voucher_date >= CAST($2 AS date)
          AND v.voucher_date <= CAST($3 AS date)
          AND v.status = 'Posted'
          AND NOT EXISTS (
            SELECT 1
            FROM voucher_lines vl
            WHERE vl.voucher_id = v.id
              AND vl.company_id = v.company_id
          )
      `, fiscalYear),
      this.countBusinessDrafts(fiscalYear),
      this.draftVoucherDetails(fiscalYear),
      this.businessDraftDetails(fiscalYear),
      this.countRows(`
        SELECT COUNT(*)::int AS count
        FROM bank_cheques
        WHERE company_id = CAST($1 AS uuid)
          AND COALESCE(issue_date, created_at::date) >= CAST($2 AS date)
          AND COALESCE(issue_date, created_at::date) <= CAST($3 AS date)
          AND status IN ('Reserved', 'Issued', 'Bounced', 'Stopped')
      `, fiscalYear),
      this.yearVoucherTotals(fiscalYear),
    ]);

    const difference = Math.abs(Number(trialBalance.total_debit) - Number(trialBalance.total_credit));
    return [
      {
        key: 'fiscal_year_status',
        label: 'Fiscal Year Is Open',
        status: fiscalYear.status === 'closed' ? 'Failed' : 'Passed',
        count: fiscalYear.status === 'closed' ? 1 : 0,
        message: fiscalYear.status === 'closed' ? 'Fiscal Year is already closed.' : 'Fiscal Year is available for closing.',
        blocking: true,
      },
      {
        key: 'periods_closed',
        label: 'Fiscal Periods Ready',
        status: 'Passed',
        count: openPeriods,
        message: openPeriods > 0
          ? `${openPeriods} open or locked period(s) will be closed with the Fiscal Year.`
          : 'All fiscal periods are already closed.',
        blocking: false,
      },
      {
        key: 'draft_vouchers',
        label: 'No Draft Vouchers',
        status: draftVouchers > 0 ? 'Failed' : 'Passed',
        count: draftVouchers,
        message: draftVouchers > 0 ? `${draftVouchers} draft voucher(s) must be posted or voided.` : 'No draft vouchers found.',
        blocking: true,
        details: draftVoucherDetails,
      },
      {
        key: 'unposted_documents',
        label: 'No Unposted Documents',
        status: businessDrafts > 0 ? 'Failed' : 'Passed',
        count: businessDrafts,
        message: businessDrafts > 0 ? `${businessDrafts} draft business document(s) must be posted or voided.` : 'No draft business documents found.',
        blocking: true,
        details: businessDraftDetails,
      },
      {
        key: 'voucher_balance',
        label: 'Posted Vouchers Are Balanced',
        status: unbalancedPostedVouchers > 0 ? 'Failed' : 'Passed',
        count: unbalancedPostedVouchers,
        message: unbalancedPostedVouchers > 0 ? `${unbalancedPostedVouchers} posted voucher(s) are not balanced.` : 'All posted vouchers are balanced.',
        blocking: true,
      },
      {
        key: 'voucher_lines',
        label: 'Posted Vouchers Have Lines',
        status: postedVoucherWithoutLines > 0 ? 'Failed' : 'Passed',
        count: postedVoucherWithoutLines,
        message: postedVoucherWithoutLines > 0 ? `${postedVoucherWithoutLines} posted voucher(s) have no voucher lines.` : 'All posted vouchers have voucher lines.',
        blocking: true,
      },
      {
        key: 'trial_balance',
        label: 'Trial Balance Is Balanced',
        status: difference > 0.005 ? 'Failed' : 'Passed',
        count: difference > 0.005 ? 1 : 0,
        message: difference > 0.005
          ? `Trial Balance difference is ${difference.toFixed(2)}.`
          : `Trial Balance is balanced. Debit ${Number(trialBalance.total_debit).toFixed(2)} / Credit ${Number(trialBalance.total_credit).toFixed(2)}.`,
        blocking: true,
      },
      {
        key: 'cheque_clearance',
        label: 'No Pending Cheque Action',
        status: unresolvedCheques > 0 ? 'Failed' : 'Passed',
        count: unresolvedCheques,
        message: unresolvedCheques > 0 ? `${unresolvedCheques} cheque(s) still need clearing, cancellation, or voiding.` : 'No pending cheque actions found.',
        blocking: true,
      },
    ];
  }

  private async assertClosingSchemaReady() {
    const missingTables = await this.missingClosingTables([
      'vouchers',
      'voucher_lines',
      'bank_cheques',
      ...businessDraftDocuments.map(document => document.tableName),
    ]);
    if (missingTables.length > 0) {
      throw businessError(`Required closing table(s) not found: ${missingTables.join(', ')}. Please run database migrations before reviewing closing issues.`);
    }

    const missingColumns = await this.missingClosingColumns([
      { tableName: 'vouchers', columnName: 'company_id' },
      { tableName: 'vouchers', columnName: 'voucher_number' },
      { tableName: 'vouchers', columnName: 'voucher_type' },
      { tableName: 'vouchers', columnName: 'voucher_date' },
      { tableName: 'vouchers', columnName: 'reference' },
      { tableName: 'vouchers', columnName: 'narration' },
      { tableName: 'vouchers', columnName: 'status' },
      { tableName: 'vouchers', columnName: 'total_debit' },
      { tableName: 'bank_accounts', columnName: 'id' },
      { tableName: 'bank_accounts', columnName: 'account_title' },
      { tableName: 'customers', columnName: 'id' },
      { tableName: 'customers', columnName: 'name' },
      { tableName: 'suppliers', columnName: 'id' },
      { tableName: 'suppliers', columnName: 'name' },
      ...businessDraftDocuments.flatMap(document => [
        { tableName: document.tableName, columnName: 'id' },
        { tableName: document.tableName, columnName: 'company_id' },
        { tableName: document.tableName, columnName: document.dateColumn },
        { tableName: document.tableName, columnName: 'status' },
      ]),
      { tableName: 'purchase_invoices', columnName: 'purchase_number' },
      { tableName: 'purchase_invoices', columnName: 'supplier_id' },
      { tableName: 'purchase_invoices', columnName: 'net_amount' },
      { tableName: 'sale_invoices', columnName: 'sale_number' },
      { tableName: 'sale_invoices', columnName: 'customer_id' },
      { tableName: 'sale_invoices', columnName: 'net_amount' },
      { tableName: 'purchase_returns', columnName: 'purchase_return_number' },
      { tableName: 'purchase_returns', columnName: 'supplier_id' },
      { tableName: 'purchase_returns', columnName: 'net_amount' },
      { tableName: 'sale_returns', columnName: 'sale_return_number' },
      { tableName: 'sale_returns', columnName: 'customer_id' },
      { tableName: 'sale_returns', columnName: 'net_amount' },
      { tableName: 'stock_transfers', columnName: 'transfer_number' },
      { tableName: 'stock_transfers', columnName: 'total_cost' },
      { tableName: 'stock_adjustments', columnName: 'adjustment_number' },
      { tableName: 'stock_adjustments', columnName: 'total_cost_in' },
      { tableName: 'stock_adjustments', columnName: 'total_cost_out' },
      { tableName: 'bank_deposits', columnName: 'deposit_number' },
      { tableName: 'bank_deposits', columnName: 'bank_account_id' },
      { tableName: 'bank_deposits', columnName: 'total_amount' },
    ]);
    if (missingColumns.length > 0) {
      throw businessError(`Required closing column(s) not found: ${missingColumns.join(', ')}. Please run database migrations before reviewing closing issues.`);
    }
  }

  private async missingClosingTables(tableNames: string[]) {
    const placeholders = tableNames.map((_, index) => `$${index + 1}`).join(', ');
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string; exists: boolean }>>(
      `
      SELECT
        table_name,
        to_regclass('public.' || table_name) IS NOT NULL AS exists
      FROM unnest(ARRAY[${placeholders}]::text[]) AS table_name
      `,
      ...tableNames,
    );
    return rows.filter(row => !row.exists).map(row => row.table_name);
  }

  private async missingClosingColumns(tableColumns: Array<{ tableName: string; columnName: string }>) {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string; exists: boolean }>>`
      WITH required_columns AS (
        SELECT
          item->>'tableName' AS table_name,
          item->>'columnName' AS column_name
        FROM jsonb_array_elements(${JSON.stringify(tableColumns)}::jsonb) AS item
      )
      SELECT
        required_columns.table_name,
        required_columns.column_name,
        columns.column_name IS NOT NULL AS exists
      FROM required_columns
      LEFT JOIN information_schema.columns columns
        ON columns.table_schema = 'public'
        AND columns.table_name = required_columns.table_name
        AND columns.column_name = required_columns.column_name
    `;
    return rows
      .filter(row => !row.exists)
      .map(row => `${row.table_name}.${row.column_name}`);
  }

  private async countRows(sql: string, fiscalYear: FiscalYear) {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      sql,
      this.companyId,
      toDateText(fiscalYear.startDate),
      toDateText(fiscalYear.endDate),
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async countBusinessDrafts(fiscalYear: FiscalYear) {
    const draftCounts = await Promise.all(
      businessDraftDocuments.map(document =>
        this.countRows(`
          SELECT COUNT(*)::int AS count
          FROM ${document.tableName}
          WHERE company_id = CAST($1 AS uuid)
            AND ${document.dateColumn} >= CAST($2 AS date)
            AND ${document.dateColumn} <= CAST($3 AS date)
            AND status = 'Draft'
        `, fiscalYear),
      ),
    );
    return draftCounts.reduce((total, count) => total + count, 0);
  }

  private async draftVoucherDetails(fiscalYear: FiscalYear): Promise<ClosingCheckDetail[]> {
    const rows = await prisma.$queryRaw<Array<{ voucher_type: string; count: number; sample_numbers: string | null }>>`
      SELECT
        voucher_type,
        COUNT(*)::int AS count,
        STRING_AGG(voucher_number, ', ' ORDER BY voucher_date DESC, voucher_number DESC) AS sample_numbers
      FROM (
        SELECT voucher_type, voucher_number, voucher_date
        FROM vouchers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND voucher_date >= ${toDateText(fiscalYear.startDate)}::date
          AND voucher_date <= ${toDateText(fiscalYear.endDate)}::date
          AND status = 'Draft'
        ORDER BY voucher_date DESC, voucher_number DESC
        LIMIT 20
      ) draft_vouchers
      GROUP BY voucher_type
      ORDER BY voucher_type
    `;
    return rows.map(row => ({
      label: voucherTypeLabels[row.voucher_type] ?? row.voucher_type,
      count: Number(row.count ?? 0),
      note: row.sample_numbers ? `Voucher No: ${row.sample_numbers}` : undefined,
    }));
  }

  private async businessDraftDetails(fiscalYear: FiscalYear): Promise<ClosingCheckDetail[]> {
    const draftCounts = await Promise.all(
      businessDraftDocuments.map(async document => {
        const count = await this.countRows(`
          SELECT COUNT(*)::int AS count
          FROM ${document.tableName}
          WHERE company_id = CAST($1 AS uuid)
            AND ${document.dateColumn} >= CAST($2 AS date)
            AND ${document.dateColumn} <= CAST($3 AS date)
            AND status = 'Draft'
        `, fiscalYear);
        return {
          label: document.label,
          count,
        };
      }),
    );
    return draftCounts.filter(detail => detail.count > 0);
  }

  private async draftVoucherIssueRows(fiscalYear: FiscalYear, skip: number, take: number) {
    const [totalRows, rows] = await Promise.all([
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM vouchers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND voucher_date >= ${toDateText(fiscalYear.startDate)}::date
          AND voucher_date <= ${toDateText(fiscalYear.endDate)}::date
          AND status = 'Draft'
      `,
      prisma.$queryRaw<Array<ClosingIssueRow & { voucher_type: string }>>`
        SELECT
          id::text,
          'Vouchers' AS module_name,
          voucher_type AS document_type,
          voucher_number AS document_number,
          voucher_date AS document_date,
          COALESCE(NULLIF(reference, ''), NULLIF(narration, '')) AS party_name,
          total_debit::text AS amount,
          status,
          NULL::text AS source_path,
          voucher_type
        FROM vouchers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND voucher_date >= ${toDateText(fiscalYear.startDate)}::date
          AND voucher_date <= ${toDateText(fiscalYear.endDate)}::date
          AND status = 'Draft'
        ORDER BY voucher_date DESC, voucher_number DESC
        LIMIT ${take} OFFSET ${skip}
      `,
    ]);

    return {
      total: Number(totalRows[0]?.count ?? 0),
      rows: rows.map(row => ({
        ...row,
        document_type: voucherTypeLabels[row.voucher_type] ?? row.voucher_type,
        source_path: voucherTypePaths[row.voucher_type] ?? '/vouchers',
      })),
    };
  }

  private async businessDraftIssueRows(fiscalYear: FiscalYear, skip: number, take: number) {
    const [total, rows] = await Promise.all([
      this.countBusinessDrafts(fiscalYear),
      prisma.$queryRaw<ClosingIssueRow[]>`
        SELECT *
        FROM (
          SELECT
            pi.id::text,
            'Purchase Invoices' AS module_name,
            'Purchase Invoice' AS document_type,
            pi.purchase_number AS document_number,
            pi.purchase_date AS document_date,
            s.name AS party_name,
            pi.net_amount::text AS amount,
            pi.status,
            '/ap/purchases' AS source_path
          FROM purchase_invoices pi
          LEFT JOIN suppliers s ON s.id = pi.supplier_id
          WHERE pi.company_id = CAST(${this.companyId} AS uuid)
            AND pi.purchase_date >= ${toDateText(fiscalYear.startDate)}::date
            AND pi.purchase_date <= ${toDateText(fiscalYear.endDate)}::date
            AND pi.status = 'Draft'
          UNION ALL
          SELECT
            si.id::text,
            'Sales Invoices' AS module_name,
            'Sales Invoice' AS document_type,
            si.sale_number AS document_number,
            si.sale_date AS document_date,
            c.name AS party_name,
            si.net_amount::text AS amount,
            si.status,
            '/ar/sales' AS source_path
          FROM sale_invoices si
          LEFT JOIN customers c ON c.id = si.customer_id
          WHERE si.company_id = CAST(${this.companyId} AS uuid)
            AND si.sale_date >= ${toDateText(fiscalYear.startDate)}::date
            AND si.sale_date <= ${toDateText(fiscalYear.endDate)}::date
            AND si.status = 'Draft'
          UNION ALL
          SELECT
            pr.id::text,
            'Purchase Returns' AS module_name,
            'Purchase Return' AS document_type,
            pr.purchase_return_number AS document_number,
            pr.purchase_return_date AS document_date,
            s.name AS party_name,
            pr.net_amount::text AS amount,
            pr.status,
            '/ap/purchase-returns' AS source_path
          FROM purchase_returns pr
          LEFT JOIN suppliers s ON s.id = pr.supplier_id
          WHERE pr.company_id = CAST(${this.companyId} AS uuid)
            AND pr.purchase_return_date >= ${toDateText(fiscalYear.startDate)}::date
            AND pr.purchase_return_date <= ${toDateText(fiscalYear.endDate)}::date
            AND pr.status = 'Draft'
          UNION ALL
          SELECT
            sr.id::text,
            'Sales Returns' AS module_name,
            'Sales Return' AS document_type,
            sr.sale_return_number AS document_number,
            sr.sale_return_date AS document_date,
            c.name AS party_name,
            sr.net_amount::text AS amount,
            sr.status,
            '/ar/sale-returns' AS source_path
          FROM sale_returns sr
          LEFT JOIN customers c ON c.id = sr.customer_id
          WHERE sr.company_id = CAST(${this.companyId} AS uuid)
            AND sr.sale_return_date >= ${toDateText(fiscalYear.startDate)}::date
            AND sr.sale_return_date <= ${toDateText(fiscalYear.endDate)}::date
            AND sr.status = 'Draft'
          UNION ALL
          SELECT
            st.id::text,
            'Stock Transfers' AS module_name,
            'Stock Transfer' AS document_type,
            st.transfer_number AS document_number,
            st.transfer_date AS document_date,
            NULL::text AS party_name,
            st.total_cost::text AS amount,
            st.status,
            '/inventory/stock-transfers' AS source_path
          FROM stock_transfers st
          WHERE st.company_id = CAST(${this.companyId} AS uuid)
            AND st.transfer_date >= ${toDateText(fiscalYear.startDate)}::date
            AND st.transfer_date <= ${toDateText(fiscalYear.endDate)}::date
            AND st.status = 'Draft'
          UNION ALL
          SELECT
            sa.id::text,
            'Stock Adjustments' AS module_name,
            'Stock Adjustment' AS document_type,
            sa.adjustment_number AS document_number,
            sa.adjustment_date AS document_date,
            NULL::text AS party_name,
            GREATEST(sa.total_cost_in, sa.total_cost_out)::text AS amount,
            sa.status,
            '/inventory/stock-adjustments' AS source_path
          FROM stock_adjustments sa
          WHERE sa.company_id = CAST(${this.companyId} AS uuid)
            AND sa.adjustment_date >= ${toDateText(fiscalYear.startDate)}::date
            AND sa.adjustment_date <= ${toDateText(fiscalYear.endDate)}::date
            AND sa.status = 'Draft'
          UNION ALL
          SELECT
            bd.id::text,
            'Bank Deposits' AS module_name,
            'Bank Deposit' AS document_type,
            bd.deposit_number AS document_number,
            bd.deposit_date AS document_date,
            ba.account_title AS party_name,
            bd.total_amount::text AS amount,
            bd.status,
            '/bank' AS source_path
          FROM bank_deposits bd
          LEFT JOIN bank_accounts ba ON ba.id = bd.bank_account_id
          WHERE bd.company_id = CAST(${this.companyId} AS uuid)
            AND bd.deposit_date >= ${toDateText(fiscalYear.startDate)}::date
            AND bd.deposit_date <= ${toDateText(fiscalYear.endDate)}::date
            AND bd.status = 'Draft'
        ) closing_issues
        ORDER BY document_date DESC, module_name ASC, document_number DESC
        LIMIT ${take} OFFSET ${skip}
      `,
    ]);

    return { total, rows };
  }

  private async yearVoucherTotals(fiscalYear: FiscalYear) {
    const rows = await prisma.$queryRaw<Array<{ transaction_count: number; total_debit: string; total_credit: string }>>`
      SELECT
        COUNT(DISTINCT v.id)::int AS transaction_count,
        COALESCE(SUM(vl.dr_amount), 0)::text AS total_debit,
        COALESCE(SUM(vl.cr_amount), 0)::text AS total_credit
      FROM vouchers v
      LEFT JOIN voucher_lines vl
        ON vl.voucher_id = v.id
        AND vl.company_id = v.company_id
      WHERE v.company_id = CAST(${this.companyId} AS uuid)
        AND v.voucher_date >= ${toDateText(fiscalYear.startDate)}::date
        AND v.voucher_date <= ${toDateText(fiscalYear.endDate)}::date
        AND v.status = 'Posted'
    `;
    return {
      transaction_count: Number(rows[0]?.transaction_count ?? 0),
      total_debit: rows[0]?.total_debit ?? '0',
      total_credit: rows[0]?.total_credit ?? '0',
    };
  }

  private async assertPeriodExists(periodId: string) {
    const period = await prisma.fiscalPeriod.findFirst({
      where: {
        id: periodId,
        companyId: this.companyId,
        isDeleted: false,
      },
    });
    if (!period) {
      throw businessError('Fiscal Period was not found.', 404);
    }
    return period;
  }
}
