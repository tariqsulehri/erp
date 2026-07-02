import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { PostingDateService } from '../fiscal-years/posting-date.service.js';
import type { CreateVoucherInput, ListVouchersQuery, VoucherApprovalActionInput, VoucherRejectActionInput } from './voucher.schema.js';

const voucherPrefixes: Record<string, string> = {
  BRV: 'BRV',
  BPV: 'BPV',
  CRV: 'CRV',
  CPV: 'CPV',
  JV: 'JV',
  CV: 'CV',
  DN: 'DN',
  CN: 'CN',
  PI: 'PI',
};

type ApprovalStatus = 'Not Required' | 'Pending' | 'Approved' | 'Rejected';
type CashBankVoucherType = 'BRV' | 'BPV' | 'CRV' | 'CPV';
type VoucherLineSide = 'Debit' | 'Credit';

const cashAccountCodePrefixes = ['010101', '010110'];
const cashBankVoucherRules: Record<CashBankVoucherType, {
  primaryAccountKind: 'Bank' | 'Cash';
  primarySide: VoucherLineSide;
  lineSide: VoucherLineSide;
  primaryAccountLabel: string;
  lineAccountLabel: string;
}> = {
  BRV: {
    primaryAccountKind: 'Bank',
    primarySide: 'Debit',
    lineSide: 'Credit',
    primaryAccountLabel: 'Bank Account',
    lineAccountLabel: 'Received From Account',
  },
  BPV: {
    primaryAccountKind: 'Bank',
    primarySide: 'Credit',
    lineSide: 'Debit',
    primaryAccountLabel: 'Bank Account',
    lineAccountLabel: 'Paid To Account',
  },
  CRV: {
    primaryAccountKind: 'Cash',
    primarySide: 'Debit',
    lineSide: 'Credit',
    primaryAccountLabel: 'Cash Account',
    lineAccountLabel: 'Received From Account',
  },
  CPV: {
    primaryAccountKind: 'Cash',
    primarySide: 'Credit',
    lineSide: 'Debit',
    primaryAccountLabel: 'Cash Account',
    lineAccountLabel: 'Paid To Account',
  },
};

function safeUuid(id: string | undefined) {
  if (!id) return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
}

function businessError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

function isCashBankVoucherType(voucherType: string): voucherType is CashBankVoucherType {
  return Object.prototype.hasOwnProperty.call(cashBankVoucherRules, voucherType);
}

function isCashAccount(account: { code: string; accountType: string; isActive: boolean; isPosting: boolean }) {
  return account.isActive &&
    account.isPosting &&
    account.accountType === 'Asset' &&
    cashAccountCodePrefixes.some(prefix => account.code.startsWith(prefix));
}

function assertLineSide(line: CreateVoucherInput['lines'][number], side: VoucherLineSide, lineNumber: number, label: string) {
  if (side === 'Debit' && !(line.dr_amount > 0 && line.cr_amount === 0)) {
    throw businessError(`${label} must be a Debit line on line ${lineNumber}.`);
  }
  if (side === 'Credit' && !(line.cr_amount > 0 && line.dr_amount === 0)) {
    throw businessError(`${label} must be a Credit line on line ${lineNumber}.`);
  }
}

function databaseDate(dateText: string) {
  const date = new Date(`${dateText}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw businessError('Voucher Date is not valid.');
  return date;
}

function voucherToResponse(voucher: any) {
  return {
    id: voucher.id,
    company_id: voucher.companyId,
    voucher_number: voucher.voucherNumber,
    voucher_type: voucher.voucherType,
    voucher_date: voucher.voucherDate,
    reference: voucher.reference,
    narration: voucher.narration,
    status: voucher.status,
    approval_status: voucher.approvalStatus ?? 'Not Required',
    approval_requested_by: voucher.approvalRequestedBy,
    approval_requested_at: voucher.approvalRequestedAt,
    approved_by: voucher.approvedBy,
    approved_at: voucher.approvedAt,
    rejected_by: voucher.rejectedBy,
    rejected_at: voucher.rejectedAt,
    rejection_reason: voucher.rejectionReason,
    total_debit: String(voucher.totalDebit ?? '0'),
    total_credit: String(voucher.totalCredit ?? '0'),
    created_by: voucher.createdBy,
    posted_by: voucher.postedBy,
    posted_at: voucher.postedAt,
    voided_by: voucher.voidedBy,
    voided_at: voucher.voidedAt,
    void_reason: voucher.voidReason,
    created_at: voucher.createdAt,
    updated_at: voucher.updatedAt,
    lines: (voucher.lines ?? [])
      .slice()
      .sort((a: any, b: any) => a.lineNo - b.lineNo)
      .map((line: any) => ({
        id: line.id,
        voucher_id: line.voucherId,
        company_id: line.companyId,
        account_id: line.accountId,
        account_code: line.accountCode,
        account_name: line.accountName,
        dr_amount: String(line.debitAmount ?? '0'),
        cr_amount: String(line.creditAmount ?? '0'),
        narration: line.narration,
        line_no: line.lineNo,
        created_at: line.createdAt,
      })),
    approvals: (voucher.approvals ?? [])
      .slice()
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((approval: any) => ({
        id: approval.id,
        company_id: approval.companyId,
        voucher_id: approval.documentId,
        action: approval.approvalStatus,
        note: approval.remarks,
        action_by: approval.approvedById,
        action_at: approval.approvedAt ?? approval.createdAt,
        created_at: approval.createdAt,
      })),
  };
}

export class VoucherService {
  constructor(private readonly companyId: string) {}

  private async assertDateInOpenPeriod(dateText: string) {
    const postingDate = new PostingDateService(this.companyId);
    const result = await postingDate.validate(dateText);
    if (!result.canPost) throw businessError(`Invalid Voucher Date: ${result.reason}`);
  }

  private validateLines(input: CreateVoucherInput) {
    let totalDebit = 0;
    let totalCredit = 0;

    input.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (!line.account_code.trim()) throw businessError(`Account Code is required on line ${lineNumber}.`);
      if (!line.account_name.trim()) throw businessError(`Account Name is required on line ${lineNumber}.`);
      if (!Number.isFinite(line.dr_amount) || !Number.isFinite(line.cr_amount)) {
        throw businessError(`Debit and Credit must be valid numbers on line ${lineNumber}.`);
      }
      if (line.dr_amount < 0 || line.cr_amount < 0) {
        throw businessError(`Debit and Credit cannot be negative on line ${lineNumber}.`);
      }
      if (line.dr_amount === 0 && line.cr_amount === 0) {
        throw businessError(`Debit or Credit amount is required on line ${lineNumber}.`);
      }
      if (line.dr_amount > 0 && line.cr_amount > 0) {
        throw businessError(`Line ${lineNumber} cannot have both Debit and Credit amounts.`);
      }

      totalDebit += line.dr_amount;
      totalCredit += line.cr_amount;
    });

    if (totalDebit <= 0 || totalCredit <= 0) throw businessError('Voucher must have both Debit and Credit amounts.');
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw businessError(`Voucher is not balanced. Debit ${totalDebit.toFixed(2)} does not match Credit ${totalCredit.toFixed(2)}.`);
    }

    return { totalDebit, totalCredit };
  }

  private assertSupportedFields(input: CreateVoucherInput) {
    if (input.auto_reverse_date) {
      throw businessError('Auto Reverse Date is not enabled for vouchers yet.');
    }
    const hasUnsupportedLineField = input.lines.some(line =>
      line.cost_center_id || line.project_id || line.department_id,
    );
    if (hasUnsupportedLineField) {
      throw businessError('Project, Cost Center, and Department are not enabled for voucher lines yet.');
    }
  }

  private async assertCashBankAccountRules(input: CreateVoucherInput) {
    if (!isCashBankVoucherType(input.voucher_type)) return;

    const rule = cashBankVoucherRules[input.voucher_type];
    const sortedLines = [...input.lines].sort((a, b) => (a.line_no ?? 0) - (b.line_no ?? 0));
    const primaryLine = sortedLines[0];
    if (!primaryLine) throw businessError(`${rule.primaryAccountLabel} is required.`);

    const accountIds = [...new Set(sortedLines.map(line => line.account_id))];
    const accounts = await prisma.account.findMany({
      where: {
        companyId: this.companyId,
        id: { in: accountIds },
        isDeleted: false,
      },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        isActive: true,
        isPosting: true,
      },
    });
    const accountsById = new Map(accounts.map(account => [account.id, account]));
    const activeBankAccounts = await prisma.bankAccount.findMany({
      where: {
        companyId: this.companyId,
        isActive: true,
        ledgerAccountId: { in: accountIds },
      },
      select: { ledgerAccountId: true },
    });
    const bankLedgerAccountIds = new Set(activeBankAccounts.map(account => account.ledgerAccountId));

    for (const [index, line] of sortedLines.entries()) {
      const lineNumber = line.line_no ?? index + 1;
      const account = accountsById.get(line.account_id);
      if (!account || !account.isActive || !account.isPosting) {
        throw businessError(`Account was not found or is inactive on line ${lineNumber}.`);
      }
      if (line.account_code !== account.code || line.account_name !== account.name) {
        throw businessError(`Account details are not current on line ${lineNumber}. Please select the account again.`);
      }
    }

    const primaryAccount = accountsById.get(primaryLine.account_id);
    if (!primaryAccount) throw businessError(`${rule.primaryAccountLabel} was not found.`);

    if (rule.primaryAccountKind === 'Bank' && !bankLedgerAccountIds.has(primaryLine.account_id)) {
      throw businessError(`${rule.primaryAccountLabel} must be an active linked Bank Account.`);
    }
    if (rule.primaryAccountKind === 'Cash' && !isCashAccount(primaryAccount)) {
      throw businessError(`${rule.primaryAccountLabel} must be an active Cash posting account.`);
    }
    assertLineSide(primaryLine, rule.primarySide, primaryLine.line_no ?? 1, rule.primaryAccountLabel);

    for (const [index, line] of sortedLines.slice(1).entries()) {
      const lineNumber = line.line_no ?? index + 2;
      const account = accountsById.get(line.account_id);
      if (!account) throw businessError(`${rule.lineAccountLabel} was not found on line ${lineNumber}.`);
      if (line.account_id === primaryLine.account_id) {
        throw businessError(`${rule.lineAccountLabel} cannot be the selected ${rule.primaryAccountLabel} on line ${lineNumber}.`);
      }
      if (isCashAccount(account) || bankLedgerAccountIds.has(line.account_id)) {
        throw businessError(`${rule.lineAccountLabel} cannot be a Cash or Bank control account on line ${lineNumber}. Use a Contra Voucher for cash and bank transfers.`);
      }
      assertLineSide(line, rule.lineSide, lineNumber, rule.lineAccountLabel);
    }
  }

  private approvalStatusForCreate(input: CreateVoucherInput): ApprovalStatus {
    return input.submit_for_approval ? 'Pending' : 'Not Required';
  }

  private assertVoucherCanUseApproval(voucher: { status: string }) {
    if (voucher.status !== 'Draft') {
      throw businessError('Only Draft vouchers can use the approval process.');
    }
  }

  private async addApprovalHistory(
    transaction: Prisma.TransactionClient,
    voucherId: string,
    action: 'Requested' | 'Approved' | 'Rejected',
    note: string | null,
    userId?: string,
  ) {
    await transaction.$executeRaw`
      INSERT INTO document_approvals (
        company_id,
        document_type,
        document_id,
        approval_status,
        approved_by_id,
        approved_at,
        remarks
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        'Voucher',
        CAST(${voucherId} AS uuid),
        ${action === 'Requested' ? 'Pending' : action},
        ${safeUuid(userId) ?? null}::uuid,
        now(),
        ${note}
      )
    `;
  }

  private async nextNumber(voucherType: string, year: number, transaction: Prisma.TransactionClient) {
    const prefix = `${voucherPrefixes[voucherType]}-${year}-`;
    const last = await transaction.voucher.findFirst({
      where: {
        companyId: this.companyId,
        voucherType,
        voucherNumber: { startsWith: prefix },
      },
      orderBy: { voucherNumber: 'desc' },
      select: { voucherNumber: true },
    });

    const nextSequence = last ? Number.parseInt(last.voucherNumber.split('-').pop() ?? '0', 10) + 1 : 1;
    return `${prefix}${String(Number.isFinite(nextSequence) ? nextSequence : 1).padStart(4, '0')}`;
  }

  private assertVoucherCanBeEdited(voucher: { status: string; approvalStatus: string | null }) {
    if (voucher.status !== 'Draft') {
      throw businessError('Only Draft vouchers can be edited.');
    }
    if (voucher.approvalStatus === 'Pending') {
      throw businessError('This voucher is waiting for approval and cannot be edited.');
    }
    if (voucher.approvalStatus === 'Approved') {
      throw businessError('Approved vouchers cannot be edited. Create a new correction if changes are needed.');
    }
  }

  async create(input: CreateVoucherInput, userId?: string) {
    const date = databaseDate(input.voucher_date);
    this.assertSupportedFields(input);
    const { totalDebit, totalCredit } = this.validateLines(input);
    const approvalStatus = this.approvalStatusForCreate(input);
    const approvalRequestedBy = approvalStatus === 'Pending' ? safeUuid(userId) ?? null : undefined;
    await this.assertDateInOpenPeriod(input.voucher_date);
    await this.assertCashBankAccountRules(input);

    return prisma.$transaction(async transaction => {
      const voucherNumber = await this.nextNumber(input.voucher_type, date.getFullYear(), transaction);
      const voucher = await transaction.voucher.create({
        data: {
          companyId: this.companyId,
          voucherNumber,
          voucherType: input.voucher_type,
          voucherDate: date,
          reference: input.reference || null,
          narration: input.narration || null,
          status: 'Draft',
          approvalStatus,
          approvalRequestedBy,
          approvalRequestedAt: approvalStatus === 'Pending' ? new Date() : undefined,
          totalDebit,
          totalCredit,
          createdBy: safeUuid(userId),
          lines: {
            create: input.lines.map((line, index) => ({
              companyId: this.companyId,
              accountId: line.account_id,
              accountCode: line.account_code,
              accountName: line.account_name,
              debitAmount: line.dr_amount,
              creditAmount: line.cr_amount,
              narration: line.narration || null,
              lineNo: line.line_no ?? index + 1,
            })),
          },
        },
        include: { lines: true },
      });
      if (approvalStatus === 'Pending') {
        await this.addApprovalHistory(
          transaction,
          voucher.id,
          'Requested',
          'Approval requested when the voucher was created.',
          userId,
        );
      }

      return voucherToResponse(voucher);
    });
  }

  async update(id: string, input: CreateVoucherInput, userId?: string) {
    const date = databaseDate(input.voucher_date);
    this.assertSupportedFields(input);
    const { totalDebit, totalCredit } = this.validateLines(input);
    const nextApprovalStatus = input.submit_for_approval ? 'Pending' : 'Not Required';
    const approvalRequestedBy = nextApprovalStatus === 'Pending' ? safeUuid(userId) ?? null : undefined;
    await this.assertDateInOpenPeriod(input.voucher_date);
    await this.assertCashBankAccountRules(input);

    return prisma.$transaction(async transaction => {
      const existing = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
        include: { lines: true },
      });
      if (!existing) throw businessError('Voucher was not found.');
      this.assertVoucherCanBeEdited(existing);
      if (existing.voucherType !== input.voucher_type) {
        throw businessError('Voucher Type cannot be changed while editing a Draft voucher.');
      }

      await transaction.voucherLine.deleteMany({
        where: {
          voucherId: id,
          companyId: this.companyId,
        },
      });

      const updated = await transaction.voucher.update({
        where: { id },
        data: {
          voucherDate: date,
          reference: input.reference || null,
          narration: input.narration || null,
          approvalStatus: nextApprovalStatus,
          approvalRequestedBy,
          approvalRequestedAt: nextApprovalStatus === 'Pending' ? new Date() : null,
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          totalDebit,
          totalCredit,
          lines: {
            create: input.lines.map((line, index) => ({
              companyId: this.companyId,
              accountId: line.account_id,
              accountCode: line.account_code,
              accountName: line.account_name,
              debitAmount: line.dr_amount,
              creditAmount: line.cr_amount,
              narration: line.narration || null,
              lineNo: line.line_no ?? index + 1,
            })),
          },
        },
        include: { lines: true },
      });

      if (nextApprovalStatus === 'Pending') {
        await this.addApprovalHistory(
          transaction,
          updated.id,
          'Requested',
          'Approval requested when the voucher was updated.',
          userId,
        );
      }

      return voucherToResponse(updated);
    });
  }

  async post(id: string, userId?: string) {
    const voucher = await prisma.voucher.findFirst({
      where: { id, companyId: this.companyId },
      include: { lines: true },
    });
    if (!voucher) throw businessError('Voucher was not found.');
    if (voucher.status !== 'Draft') throw businessError('Only Draft vouchers can be posted.');
    if (voucher.approvalStatus !== 'Approved') throw businessError('Voucher must be approved before posting.');

    const voucherDateText = voucher.voucherDate.toISOString().slice(0, 10);
    await this.assertDateInOpenPeriod(voucherDateText);

    const totalDebit = voucher.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0);
    const totalCredit = voucher.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw businessError(`Voucher is not balanced. Debit ${totalDebit.toFixed(2)} does not match Credit ${totalCredit.toFixed(2)}.`);
    }
    if (totalDebit <= 0) throw businessError('Voucher has zero total and cannot be posted.');

    const updated = await prisma.voucher.update({
      where: { id },
      data: {
        status: 'Posted',
        postedBy: safeUuid(userId),
        postedAt: new Date(),
      },
      include: { lines: true },
    });

    return voucherToResponse(updated);
  }

  async void(id: string, reason: string, userId?: string) {
    const voucher = await prisma.voucher.findFirst({ where: { id, companyId: this.companyId } });
    if (!voucher) throw businessError('Voucher was not found.');
    if (voucher.status === 'Voided') throw businessError('Voucher is already voided.');

    const updated = await prisma.voucher.update({
      where: { id },
      data: {
        status: 'Voided',
        voidedBy: safeUuid(userId),
        voidedAt: new Date(),
        voidReason: reason,
      },
      include: { lines: true },
    });

    return voucherToResponse(updated);
  }

  async requestApproval(id: string, input: VoucherApprovalActionInput, userId?: string) {
    return prisma.$transaction(async transaction => {
      const voucher = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
      });
      if (!voucher) throw businessError('Voucher was not found.');
      this.assertVoucherCanUseApproval(voucher);
      if (voucher.approvalStatus === 'Pending') throw businessError('Voucher is already waiting for approval.');
      if (voucher.approvalStatus === 'Approved') throw businessError('Voucher is already approved.');

      await this.addApprovalHistory(transaction, id, 'Requested', input.note ?? null, userId);
      const updated = await transaction.voucher.update({
        where: { id },
        data: {
          approvalStatus: 'Pending',
          approvalRequestedBy: safeUuid(userId) ?? null,
          approvalRequestedAt: new Date(),
          approvedBy: null,
          approvedAt: null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        },
        include: { lines: true },
      });

      return voucherToResponse(updated);
    });
  }

  async approve(id: string, input: VoucherApprovalActionInput, userId?: string) {
    return prisma.$transaction(async transaction => {
      const voucher = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
      });
      if (!voucher) throw businessError('Voucher was not found.');
      this.assertVoucherCanUseApproval(voucher);
      if (voucher.approvalStatus !== 'Pending') {
        throw businessError('Only vouchers waiting for approval can be approved.');
      }

      await this.addApprovalHistory(transaction, id, 'Approved', input.note ?? null, userId);
      const updated = await transaction.voucher.update({
        where: { id },
        data: {
          approvalStatus: 'Approved',
          approvedBy: safeUuid(userId) ?? null,
          approvedAt: new Date(),
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        },
        include: { lines: true },
      });

      return voucherToResponse(updated);
    });
  }

  async reject(id: string, input: VoucherRejectActionInput, userId?: string) {
    return prisma.$transaction(async transaction => {
      const voucher = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
      });
      if (!voucher) throw businessError('Voucher was not found.');
      this.assertVoucherCanUseApproval(voucher);
      if (voucher.approvalStatus !== 'Pending') {
        throw businessError('Only vouchers waiting for approval can be rejected.');
      }

      await this.addApprovalHistory(transaction, id, 'Rejected', input.reason, userId);
      const updated = await transaction.voucher.update({
        where: { id },
        data: {
          approvalStatus: 'Rejected',
          rejectedBy: safeUuid(userId) ?? null,
          rejectedAt: new Date(),
          rejectionReason: input.reason,
          approvedBy: null,
          approvedAt: null,
        },
        include: { lines: true },
      });

      return voucherToResponse(updated);
    });
  }

  async getById(id: string) {
    const voucher = await prisma.voucher.findFirst({
      where: { id, companyId: this.companyId },
      include: { lines: true },
    });
    if (!voucher) throw businessError('Voucher was not found.');
    return voucherToResponse(voucher);
  }

  async list(query: ListVouchersQuery) {
    const where: Prisma.VoucherWhereInput = { companyId: this.companyId };
    if (query.voucher_type) where.voucherType = query.voucher_type;
    if (query.status) where.status = query.status;
    if (query.approval_status) where.approvalStatus = query.approval_status;
    if (query.date_from || query.date_to) {
      where.voucherDate = {
        ...(query.date_from ? { gte: databaseDate(query.date_from) } : {}),
        ...(query.date_to ? { lte: databaseDate(query.date_to) } : {}),
      };
    }
    if (query.amount_from !== undefined || query.amount_to !== undefined) {
      where.totalDebit = {
        ...(query.amount_from !== undefined ? { gte: query.amount_from } : {}),
        ...(query.amount_to !== undefined ? { lte: query.amount_to } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { voucherNumber: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { narration: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        orderBy: [{ voucherDate: 'desc' }, { voucherNumber: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.voucher.count({ where }),
    ]);

    return {
      data: data.map(voucherToResponse),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.ceil(total / query.limit),
      },
    };
  }
}
