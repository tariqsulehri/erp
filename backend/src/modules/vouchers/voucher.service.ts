import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { PostingDateService } from '../fiscal-years/posting-date.service.js';
import { balancedVoucherLines, insertPostedVoucher, nextVoucherNumber } from './voucher-posting.js';
import type {
  CreateVoucherInput,
  ListVouchersQuery,
  ReverseVoucherInput,
  VoucherApprovalActionInput,
  VoucherRejectActionInput,
} from './voucher.schema.js';

const voucherPrefixes: Record<string, string> = {
  BRV: 'BRV',
  BPV: 'BPV',
  CRV: 'CRV',
  CPV: 'CPV',
  JV: 'JV',
  CV: 'CV',
  DN: 'DN',
  CN: 'CN',
  RV: 'RV',
};

// Vouchers created by these documents must be corrected from the document (return, adjustment), not reversed here.
const sourceDocumentVoucherLinks = [
  { table: 'purchase_invoices', column: 'accounting_voucher_id', label: 'Purchase Voucher' },
  { table: 'purchase_returns', column: 'accounting_voucher_id', label: 'Purchase Return' },
  { table: 'sale_invoices', column: 'accounting_voucher_id', label: 'Sale Voucher' },
  { table: 'sale_returns', column: 'accounting_voucher_id', label: 'Sale Return' },
  { table: 'stock_adjustments', column: 'accounting_voucher_id', label: 'Stock Adjustment' },
  { table: 'bank_deposits', column: 'voucher_id', label: 'Bank Deposit' },
] as const;

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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
}

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
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
    reversal_of_voucher_id: voucher.reversalOfId ?? null,
    reversed_by_voucher_id: voucher.reversalVoucherId ?? null,
    reversal_status: voucher.reversalStatus ?? 'None',
    reversed_by: voucher.reversedBy ?? null,
    reversed_at: voucher.reversedAt ?? null,
    reversal_reason: voucher.reversalReason ?? null,
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
    });

    // Amounts are summed as exact decimals; Debit must equal Credit to the cent.
    const { totalDebit, totalCredit } = balancedVoucherLines(input.lines.map(line => ({
      account: { id: line.account_id, code: line.account_code, name: line.account_name },
      debit: new Decimal(line.dr_amount),
      credit: new Decimal(line.cr_amount),
      narration: line.narration ?? '',
    })));

    return { totalDebit: Number(totalDebit.toFixed(2)), totalCredit: Number(totalCredit.toFixed(2)) };
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

  /** Every voucher line must use an active posting account of this company, with its current code and name. */
  private async assertLineAccountsUsable(input: CreateVoucherInput) {
    const accountIds = [...new Set(input.lines.map(line => line.account_id))];
    const accounts = await prisma.account.findMany({
      where: { companyId: this.companyId, id: { in: accountIds }, isDeleted: false },
      select: { id: true, code: true, name: true, isActive: true, isPosting: true },
    });
    const accountsById = new Map(accounts.map(account => [account.id, account]));
    input.lines.forEach((line, index) => {
      const lineNumber = line.line_no ?? index + 1;
      const account = accountsById.get(line.account_id);
      if (!account || !account.isActive) throw businessError(`Account was not found or is inactive on line ${lineNumber}.`);
      if (!account.isPosting) throw businessError(`Account ${account.code} on line ${lineNumber} is a header account. Select a posting account.`);
      if (line.account_code !== account.code || line.account_name !== account.name) {
        throw businessError(`Account details are not current on line ${lineNumber}. Please select the account again.`);
      }
    });
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
    return nextVoucherNumber(transaction, this.companyId, voucherPrefixes[voucherType], year);
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
    await this.assertLineAccountsUsable(input);
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
    await this.assertLineAccountsUsable(input);
    await this.assertCashBankAccountRules(input);

    return prisma.$transaction(async transaction => {
      const existing = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
        include: { lines: true },
      });
      if (!existing) throw businessError('Voucher was not found.', 404);
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
    return prisma.$transaction(async transaction => {
      // Lock the voucher row so two users cannot post the same voucher at the same time.
      await transaction.$queryRaw`
        SELECT id FROM vouchers
        WHERE id = CAST(${id} AS uuid) AND company_id = CAST(${this.companyId} AS uuid)
        FOR UPDATE
      `;
      const voucher = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
        include: { lines: true },
      });
      if (!voucher) throw businessError('Voucher was not found.', 404);
      if (voucher.status !== 'Draft') throw businessError('Only Draft vouchers can be posted.');
      if (voucher.approvalStatus !== 'Approved') throw businessError('Voucher must be approved before posting.');

      const voucherDateText = voucher.voucherDate.toISOString().slice(0, 10);
      await this.assertDateInOpenPeriod(voucherDateText);

      const { totalDebit, totalCredit } = balancedVoucherLines(voucher.lines.map(line => ({
        account: { id: line.accountId, code: line.accountCode, name: line.accountName },
        debit: new Decimal(line.debitAmount.toString()),
        credit: new Decimal(line.creditAmount.toString()),
        narration: line.narration ?? '',
      })));

      const updated = await transaction.voucher.update({
        where: { id },
        data: {
          status: 'Posted',
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          postedBy: safeUuid(userId),
          postedAt: new Date(),
        },
        include: { lines: true },
      });

      return voucherToResponse(updated);
    });
  }

  /** Void is only for Draft vouchers. Posted vouchers are corrected with reverse(). */
  async void(id: string, reason: string, userId?: string) {
    const voucher = await prisma.voucher.findFirst({ where: { id, companyId: this.companyId } });
    if (!voucher) throw businessError('Voucher was not found.', 404);
    if (voucher.status === 'Voided') throw businessError('Voucher is already voided.');
    if (voucher.status !== 'Draft') {
      throw businessError('Posted vouchers cannot be voided. Use Reverse Voucher to post a correcting entry.');
    }

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

  /**
   * Posts a Reversal Voucher (RV) with every Debit and Credit swapped, dated in an open period.
   * The original stays Posted and both stay in the ledger, so history is kept and the net effect is zero.
   */
  async reverse(id: string, input: ReverseVoucherInput, userId?: string) {
    const reversalDateText = input.reversal_date;
    const reversalDate = databaseDate(reversalDateText);
    await this.assertDateInOpenPeriod(reversalDateText);

    return prisma.$transaction(async transaction => {
      await transaction.$queryRaw`
        SELECT id FROM vouchers
        WHERE id = CAST(${id} AS uuid) AND company_id = CAST(${this.companyId} AS uuid)
        FOR UPDATE
      `;
      const voucher = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
        include: { lines: true },
      });
      if (!voucher) throw businessError('Voucher was not found.', 404);
      if (voucher.status !== 'Posted') throw businessError('Only Posted vouchers can be reversed.');
      if (voucher.reversalVoucherId) throw businessError('This voucher is already reversed.');
      if (voucher.reversalOfId) throw businessError('A Reversal Voucher cannot be reversed again.');
      if (!Object.prototype.hasOwnProperty.call(voucherPrefixes, voucher.voucherType) || voucher.voucherType === 'RV') {
        throw businessError('This voucher type cannot be reversed from the Voucher screen.');
      }
      await this.assertNotSourceDocumentVoucher(transaction, voucher.id);

      const originalDateText = voucher.voucherDate.toISOString().slice(0, 10);
      if (reversalDateText < originalDateText) {
        throw businessError(`Reversal Date cannot be earlier than the voucher date ${originalDateText}.`);
      }

      const voucherNumber = await nextVoucherNumber(transaction, this.companyId, voucherPrefixes.RV, reversalDate.getFullYear());
      const reversalId = await insertPostedVoucher(transaction, {
        companyId: this.companyId,
        voucherNumber,
        voucherType: 'RV',
        voucherDate: reversalDateText,
        reference: voucher.voucherNumber,
        narration: `Reversal of ${voucher.voucherNumber}: ${input.reason}`,
        userId: safeUuid(userId) ?? null,
        reversalOfId: voucher.id,
        lines: voucher.lines
          .slice()
          .sort((a, b) => a.lineNo - b.lineNo)
          .map(line => ({
            account: { id: line.accountId, code: line.accountCode, name: line.accountName },
            debit: new Decimal(line.creditAmount.toString()),
            credit: new Decimal(line.debitAmount.toString()),
            narration: `Reversal: ${line.narration || voucher.narration || voucher.voucherNumber}`,
          })),
      });

      await transaction.voucher.update({
        where: { id: voucher.id },
        data: {
          reversalVoucherId: reversalId,
          reversalStatus: 'Reversed',
          reversedBy: safeUuid(userId),
          reversedAt: new Date(),
          reversalReason: input.reason,
        },
      });

      const reversal = await transaction.voucher.findFirstOrThrow({
        where: { id: reversalId, companyId: this.companyId },
        include: { lines: true },
      });
      return voucherToResponse(reversal);
    });
  }

  private async assertNotSourceDocumentVoucher(transaction: Prisma.TransactionClient, voucherId: string) {
    for (const link of sourceDocumentVoucherLinks) {
      const rows = await transaction.$queryRaw<{ found: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM ${Prisma.raw(link.table)}
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND ${Prisma.raw(link.column)} = CAST(${voucherId} AS uuid)
        ) AS found
      `;
      if (rows[0]?.found) {
        throw businessError(`This voucher was created by a ${link.label}. Correct it from the ${link.label} screen with a return or adjustment.`);
      }
    }
  }

  async requestApproval(id: string, input: VoucherApprovalActionInput, userId?: string) {
    return prisma.$transaction(async transaction => {
      const voucher = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
      });
      if (!voucher) throw businessError('Voucher was not found.', 404);
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

  /** Maker-checker: the person who created or sent a voucher for approval cannot approve or reject it. */
  private assertDifferentApprover(
    voucher: { createdBy: string | null; approvalRequestedBy: string | null },
    userId: string | undefined,
    action: 'approve' | 'reject',
  ) {
    const approverId = safeUuid(userId);
    if (!approverId) throw businessError(`Please sign in to ${action} vouchers.`);
    if (approverId === voucher.createdBy || approverId === voucher.approvalRequestedBy) {
      throw businessError(`You cannot ${action} a voucher you created or sent for approval. Another approver must do this.`);
    }
  }

  async approve(id: string, input: VoucherApprovalActionInput, userId?: string) {
    return prisma.$transaction(async transaction => {
      const voucher = await transaction.voucher.findFirst({
        where: { id, companyId: this.companyId },
      });
      if (!voucher) throw businessError('Voucher was not found.', 404);
      this.assertVoucherCanUseApproval(voucher);
      if (voucher.approvalStatus !== 'Pending') {
        throw businessError('Only vouchers waiting for approval can be approved.');
      }
      this.assertDifferentApprover(voucher, userId, 'approve');

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
      if (!voucher) throw businessError('Voucher was not found.', 404);
      this.assertVoucherCanUseApproval(voucher);
      if (voucher.approvalStatus !== 'Pending') {
        throw businessError('Only vouchers waiting for approval can be rejected.');
      }
      this.assertDifferentApprover(voucher, userId, 'reject');

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
    if (!voucher) throw businessError('Voucher was not found.', 404);
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
