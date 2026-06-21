import { prisma } from '../../db/prisma.js';

function toDateText(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number(value.toString());
  }
  return Number(value ?? 0);
}

export class DashboardService {
  constructor(private readonly companyId: string) {}

  async summary() {
    const [
      totalAccounts,
      activeAccounts,
      postingAccounts,
      accountsByType,
      totalVouchers,
      postedVouchers,
      draftVouchers,
      voidedVouchers,
      vouchersByType,
      recentVouchers,
      monthlyVolume,
      activeFiscalYear,
    ] = await Promise.all([
      prisma.account.count({ where: { companyId: this.companyId, isDeleted: false } }),
      prisma.account.count({ where: { companyId: this.companyId, isDeleted: false, isActive: true } }),
      prisma.account.count({ where: { companyId: this.companyId, isDeleted: false, isPosting: true } }),
      prisma.account.groupBy({
        by: ['accountType'],
        where: { companyId: this.companyId, isDeleted: false },
        _count: { _all: true },
      }),
      prisma.voucher.count({ where: { companyId: this.companyId } }),
      prisma.voucher.count({ where: { companyId: this.companyId, status: 'Posted' } }),
      prisma.voucher.count({ where: { companyId: this.companyId, status: 'Draft' } }),
      prisma.voucher.count({ where: { companyId: this.companyId, status: 'Voided' } }),
      prisma.voucher.groupBy({
        by: ['voucherType'],
        where: { companyId: this.companyId, status: 'Posted' },
        _count: { _all: true },
        _sum: { totalDebit: true },
      }),
      prisma.voucher.findMany({
        where: { companyId: this.companyId },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.$queryRaw<Array<{ month: string; count: bigint; total: unknown }>>`
        SELECT
          TO_CHAR(voucher_date, 'Mon YYYY') AS month,
          TO_CHAR(voucher_date, 'YYYY-MM') AS sort_key,
          COUNT(*) AS count,
          COALESCE(SUM(total_debit), 0) AS total
        FROM vouchers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND status = 'Posted'
          AND voucher_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(voucher_date, 'Mon YYYY'), TO_CHAR(voucher_date, 'YYYY-MM')
        ORDER BY TO_CHAR(voucher_date, 'YYYY-MM') ASC
      `,
      prisma.fiscalYear.findFirst({
        where: { companyId: this.companyId, isDeleted: false, isActive: true },
        include: { periods: { where: { isDeleted: false }, orderBy: { periodNumber: 'asc' } } },
      }),
    ]);

    const today = new Date();
    const currentPeriod = activeFiscalYear?.periods.find(period =>
      period.startDate <= today && period.endDate >= today,
    ) ?? null;

    return {
      accounts: {
        total: totalAccounts,
        active: activeAccounts,
        inactive: totalAccounts - activeAccounts,
        posting: postingAccounts,
        byType: accountsByType.map(row => ({
          type: row.accountType,
          count: row._count._all,
        })),
      },
      vouchers: {
        total: totalVouchers,
        posted: postedVouchers,
        draft: draftVouchers,
        voided: voidedVouchers,
        byType: vouchersByType.map(row => ({
          type: row.voucherType,
          count: row._count._all,
          total: toNumber(row._sum.totalDebit),
        })),
        recent: recentVouchers.map(voucher => ({
          id: voucher.id,
          voucher_number: voucher.voucherNumber,
          voucher_type: voucher.voucherType,
          voucher_date: toDateText(voucher.voucherDate),
          narration: voucher.narration,
          total_debit: voucher.totalDebit.toString(),
          status: voucher.status,
        })),
        monthlyVolume: monthlyVolume.map(row => ({
          month: row.month,
          count: Number(row.count),
          total: toNumber(row.total),
        })),
      },
      fiscalYear: activeFiscalYear
        ? {
            id: activeFiscalYear.id,
            name: activeFiscalYear.fiscalYear,
            status: activeFiscalYear.status,
            startDate: toDateText(activeFiscalYear.startDate),
            endDate: toDateText(activeFiscalYear.endDate),
            isLocked: activeFiscalYear.isLocked,
            openPeriods: activeFiscalYear.periods.filter(period => period.status === 'open').length,
            closedPeriods: activeFiscalYear.periods.filter(period => period.status === 'closed').length,
            totalPeriods: activeFiscalYear.numberOfPeriods,
            currentPeriod: currentPeriod
              ? { name: currentPeriod.periodName, status: currentPeriod.status }
              : null,
          }
        : null,
    };
  }
}

