import { AppDataSource } from '@/db/data-source';
import { Voucher, VoucherLine, VoucherType } from './voucher.entity';
import { CreateVoucherInput, ListVouchersQuery } from './voucher.schema';
import { FiscalYearService } from '@/modules/fiscal-year/fiscal-year.service';

const VOUCHER_PREFIXES: Record<VoucherType, string> = {
  PV: 'PV', RV: 'RV', JV: 'JV', CV: 'CV', DN: 'DN', CN: 'CN',
};

export class VoucherService {
  private repo   = AppDataSource.getRepository(Voucher);
  private lineRepo = AppDataSource.getRepository(VoucherLine);

  constructor(private companyId: string) {}

  /** Returns userId only if it is a valid UUID, otherwise undefined */
  private safeUuid(id: string | undefined): string | undefined {
    if (!id) return undefined;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? id
      : undefined;
  }

  /** Generate next voucher number: PV-2026-0001 */
  private async nextNumber(type: VoucherType, year: number): Promise<string> {
    const prefix = `${VOUCHER_PREFIXES[type]}-${year}-`;
    const last = await this.repo
      .createQueryBuilder('v')
      .where('v.company_id = :cid', { cid: this.companyId })
      .andWhere('v.voucher_type = :t', { t: type })
      .andWhere('v.voucher_number LIKE :p', { p: `${prefix}%` })
      .orderBy('v.voucher_number', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const parts = last.voucher_number.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /** Validates date falls inside an open fiscal period — throws if not */
  private async assertDateInOpenPeriod(date: Date): Promise<void> {
    const fyService = new FiscalYearService(this.companyId);
    const result    = await fyService.validatePostingDate(date);
    if (!result.canPost) {
      throw new Error(`Invalid voucher date: ${result.reason}`);
    }
  }

  async createVoucher(input: CreateVoucherInput, userId: string): Promise<Voucher> {
    const date    = new Date(input.voucher_date);

    // Reject date outside any open fiscal year period
    await this.assertDateInOpenPeriod(date);

    const year    = date.getFullYear();
    const number  = await this.nextNumber(input.voucher_type, year);

    const totalDr = input.lines.reduce((s, l) => s + l.dr_amount, 0);
    const totalCr = input.lines.reduce((s, l) => s + l.cr_amount, 0);

    const voucher = this.repo.create({
      company_id:     this.companyId,
      voucher_number: number,
      voucher_type:   input.voucher_type,
      voucher_date:   date,
      reference:      input.reference,
      narration:      input.narration,
      status:         'Draft',
      total_debit:    String(totalDr),
      total_credit:   String(totalCr),
      created_by:     this.safeUuid(userId),
    });

    const saved = await this.repo.save(voucher);

    const lines = input.lines.map((l, i) =>
      this.lineRepo.create({
        voucher_id:   saved.id,
        company_id:   this.companyId,
        account_id:   l.account_id,
        account_code: l.account_code,
        account_name: l.account_name,
        dr_amount:    String(l.dr_amount),
        cr_amount:    String(l.cr_amount),
        narration:    l.narration,
        line_no:      i + 1,
      }),
    );

    saved.lines = await this.lineRepo.save(lines);
    return saved;
  }

  async postVoucher(id: string, userId: string): Promise<Voucher> {
    const voucher = await this.repo.findOne({
      where: { id, company_id: this.companyId },
      relations: ['lines'],
    });
    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status !== 'Draft') throw new Error('Only Draft vouchers can be posted');

    // Re-validate date at post time (period may have been closed after draft was saved)
    await this.assertDateInOpenPeriod(new Date(voucher.voucher_date as any));

    const dr = voucher.lines!.reduce((s, l) => s + parseFloat(l.dr_amount), 0);
    const cr = voucher.lines!.reduce((s, l) => s + parseFloat(l.cr_amount), 0);
    if (Math.abs(dr - cr) > 0.001) {
      throw new Error(`Voucher is not balanced — Debit ${dr.toFixed(2)} ≠ Credit ${cr.toFixed(2)}`);
    }
    if (dr === 0) throw new Error('Voucher has zero total — cannot post');

    await this.repo.update(id, {
      status:    'Posted',
      posted_by: this.safeUuid(userId),
      posted_at: new Date(),
    } as any);

    return this.repo.findOne({ where: { id }, relations: ['lines'] }) as Promise<Voucher>;
  }

  async voidVoucher(id: string, userId: string, reason: string): Promise<Voucher> {
    const voucher = await this.repo.findOne({ where: { id, company_id: this.companyId } });
    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status === 'Voided') throw new Error('Already voided');

    await this.repo.update(id, {
      status:      'Voided',
      voided_by:   this.safeUuid(userId),
      voided_at:   new Date(),
      void_reason: reason,
    } as any);

    return this.repo.findOne({ where: { id }, relations: ['lines'] }) as Promise<Voucher>;
  }

  async getById(id: string): Promise<Voucher | null> {
    return this.repo.findOne({
      where: { id, company_id: this.companyId },
      relations: ['lines'],
      order: { lines: { line_no: 'ASC' } } as any,
    });
  }

  async list(query: ListVouchersQuery) {
    const qb = this.repo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.lines', 'l')
      .where('v.company_id = :cid', { cid: this.companyId });

    if (query.voucher_type) qb.andWhere('v.voucher_type = :t', { t: query.voucher_type });
    if (query.status)       qb.andWhere('v.status = :s',      { s: query.status });
    if (query.date_from)    qb.andWhere('v.voucher_date >= :from', { from: query.date_from });
    if (query.date_to)      qb.andWhere('v.voucher_date <= :to',   { to:   query.date_to });
    if (query.search) {
      qb.andWhere(
        '(v.voucher_number ILIKE :q OR v.reference ILIKE :q OR v.narration ILIKE :q)',
        { q: `%${query.search}%` },
      );
    }

    const total = await qb.getCount();
    const data  = await qb
      .orderBy('v.voucher_date', 'DESC')
      .addOrderBy('v.voucher_number', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();

    return {
      data,
      pagination: {
        total,
        page:  query.page,
        limit: query.limit,
        pages: Math.ceil(total / query.limit),
      },
    };
  }
}
