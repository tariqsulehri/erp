import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { DayBookQuery } from './business-report.schema.js';

function businessError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

/** Day Book: every posted voucher in a date range with its lines, in date and number order. */
export class DayBookReportService {
  constructor(private readonly companyId: string) {}

  async getDayBook(query: DayBookQuery) {
    if (query.date_to < query.date_from) throw businessError('Date To cannot be before Date From.');

    const where: Prisma.VoucherWhereInput = {
      companyId: this.companyId,
      status: 'Posted',
      voucherDate: { gte: new Date(`${query.date_from}T00:00:00Z`), lte: new Date(`${query.date_to}T00:00:00Z`) },
      ...(query.voucher_type ? { voucherType: query.voucher_type } : {}),
    };

    const [vouchers, total, sums] = await Promise.all([
      prisma.voucher.findMany({
        where,
        include: { lines: { orderBy: { lineNo: 'asc' } } },
        orderBy: [{ voucherDate: 'asc' }, { voucherNumber: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.voucher.count({ where }),
      prisma.voucher.aggregate({ where, _sum: { totalDebit: true, totalCredit: true } }),
    ]);

    return {
      date_from: query.date_from,
      date_to: query.date_to,
      totals: {
        voucher_count: total,
        total_debit: new Decimal(String(sums._sum.totalDebit ?? 0)).toFixed(2),
        total_credit: new Decimal(String(sums._sum.totalCredit ?? 0)).toFixed(2),
      },
      vouchers: vouchers.map(voucher => ({
        id: voucher.id,
        voucher_number: voucher.voucherNumber,
        voucher_type: voucher.voucherType,
        voucher_date: voucher.voucherDate.toISOString().slice(0, 10),
        reference: voucher.reference,
        narration: voucher.narration,
        total_debit: new Decimal(voucher.totalDebit.toString()).toFixed(2),
        total_credit: new Decimal(voucher.totalCredit.toString()).toFixed(2),
        lines: voucher.lines.map(line => ({
          account_id: line.accountId,
          account_code: line.accountCode,
          account_name: line.accountName,
          debit_amount: new Decimal(line.debitAmount.toString()).toFixed(2),
          credit_amount: new Decimal(line.creditAmount.toString()).toFixed(2),
          narration: line.narration,
        })),
      })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }
}
