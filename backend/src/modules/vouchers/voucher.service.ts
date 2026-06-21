import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { PostingDateService } from '../fiscal-years/posting-date.service.js';
import type { CreateVoucherInput, ListVouchersQuery } from './voucher.schema.js';

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

function safeUuid(id: string | undefined) {
  if (!id) return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
}

function businessError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
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
    if (input.approval_status && input.approval_status !== 'Not Required') {
      throw businessError('Approval Status is not enabled for vouchers yet.');
    }
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

  async create(input: CreateVoucherInput, userId?: string) {
    const date = databaseDate(input.voucher_date);
    this.assertSupportedFields(input);
    const { totalDebit, totalCredit } = this.validateLines(input);
    await this.assertDateInOpenPeriod(input.voucher_date);

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

      return voucherToResponse(voucher);
    });
  }

  async post(id: string, userId?: string) {
    const voucher = await prisma.voucher.findFirst({
      where: { id, companyId: this.companyId },
      include: { lines: true },
    });
    if (!voucher) throw businessError('Voucher was not found.');
    if (voucher.status !== 'Draft') throw businessError('Only Draft vouchers can be posted.');

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
