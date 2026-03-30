import { router, protectedProcedure } from '@/server/trpc';
import { AppDataSource } from '@/db/data-source';
import { Account } from '@/modules/accounts/account.entity';
import { Voucher } from '@/modules/vouchers/voucher.entity';
import { FiscalYear, FiscalPeriod } from '@/modules/fiscal-year/fiscal-year.entity';

export const dashboardRouter = router({
  /**
   * All data needed to render the dashboard in one round-trip.
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const cid = ctx.company_id;
    const accountRepo = AppDataSource.getRepository(Account);
    const voucherRepo = AppDataSource.getRepository(Voucher);
    const fyRepo      = AppDataSource.getRepository(FiscalYear);
    const periodRepo  = AppDataSource.getRepository(FiscalPeriod);

    // ── Accounts ──────────────────────────────────────────────────────
    const [
      totalAccounts,
      activeAccounts,
      postingAccounts,
      accountsByType,
    ] = await Promise.all([
      accountRepo.count({ where: { company_id: cid } }),
      accountRepo.count({ where: { company_id: cid, is_active: true } }),
      accountRepo.count({ where: { company_id: cid, is_posting: true } }),
      accountRepo
        .createQueryBuilder('a')
        .select('a.account_type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('a.company_id = :cid', { cid })
        .groupBy('a.account_type')
        .getRawMany() as Promise<{ type: string; count: string }[]>,
    ]);

    // ── Vouchers ──────────────────────────────────────────────────────
    const [
      totalVouchers,
      postedVouchers,
      draftVouchers,
      voidedVouchers,
      vouchersByType,
      recentVouchers,
    ] = await Promise.all([
      voucherRepo.count({ where: { company_id: cid } }),
      voucherRepo.count({ where: { company_id: cid, status: 'Posted' } }),
      voucherRepo.count({ where: { company_id: cid, status: 'Draft'  } }),
      voucherRepo.count({ where: { company_id: cid, status: 'Voided' } }),
      voucherRepo
        .createQueryBuilder('v')
        .select('v.voucher_type', 'type')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(v.total_debit)', 'total')
        .where('v.company_id = :cid', { cid })
        .andWhere("v.status = 'Posted'")
        .groupBy('v.voucher_type')
        .getRawMany() as Promise<{ type: string; count: string; total: string }[]>,
      voucherRepo.find({
        where: { company_id: cid },
        order: { created_at: 'DESC' },
        take: 8,
      }),
    ]);

    // ── Monthly voucher volume (last 6 months) ─────────────────────────
    const monthlyVolume: { month: string; count: string; total: string }[] =
      await voucherRepo
        .createQueryBuilder('v')
        .select("TO_CHAR(v.voucher_date, 'Mon YYYY')", 'month')
        .addSelect("TO_CHAR(v.voucher_date, 'YYYY-MM')", 'sort_key')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(v.total_debit)', 'total')
        .where('v.company_id = :cid', { cid })
        .andWhere("v.status = 'Posted'")
        .andWhere("v.voucher_date >= NOW() - INTERVAL '6 months'")
        .groupBy("TO_CHAR(v.voucher_date, 'Mon YYYY'), TO_CHAR(v.voucher_date, 'YYYY-MM')")
        .orderBy("TO_CHAR(v.voucher_date, 'YYYY-MM')", 'ASC')
        .getRawMany();

    // ── Fiscal Year ────────────────────────────────────────────────────
    const activeFY = await fyRepo.findOne({
      where: { company_id: cid, is_active: true },
    });

    let openPeriods = 0;
    let closedPeriods = 0;
    let currentPeriod: FiscalPeriod | null = null;
    if (activeFY) {
      const periods = await periodRepo.find({ where: { fiscal_year_id: activeFY.id } });
      openPeriods   = periods.filter(p => p.status === 'open').length;
      closedPeriods = periods.filter(p => p.status === 'closed').length;
      const today = new Date();
      currentPeriod = periods.find(p =>
        new Date(p.start_date) <= today && new Date(p.end_date) >= today,
      ) ?? null;
    }

    return {
      accounts: {
        total:    totalAccounts,
        active:   activeAccounts,
        inactive: totalAccounts - activeAccounts,
        posting:  postingAccounts,
        byType:   accountsByType.map(r => ({ type: r.type, count: parseInt(r.count, 10) })),
      },
      vouchers: {
        total:   totalVouchers,
        posted:  postedVouchers,
        draft:   draftVouchers,
        voided:  voidedVouchers,
        byType:  vouchersByType.map(r => ({
          type:  r.type,
          count: parseInt(r.count, 10),
          total: parseFloat(r.total ?? '0'),
        })),
        recent:        recentVouchers,
        monthlyVolume: monthlyVolume.map(r => ({
          month: r.month,
          count: parseInt(r.count, 10),
          total: parseFloat(r.total ?? '0'),
        })),
      },
      fiscalYear: activeFY
        ? {
            id:            activeFY.id,
            name:          activeFY.fiscal_year,
            status:        activeFY.status,
            startDate:     activeFY.start_date,
            endDate:       activeFY.end_date,
            isLocked:      activeFY.is_locked,
            openPeriods,
            closedPeriods,
            totalPeriods:  activeFY.number_of_periods,
            currentPeriod: currentPeriod
              ? { name: currentPeriod.period_name, status: currentPeriod.status }
              : null,
          }
        : null,
    };
  }),
});
