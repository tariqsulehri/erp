import { AppDataSource } from '@/db/data-source';
import { Voucher, VoucherLine, VoucherType } from './voucher.entity';
import { CreateVoucherInput, ListVouchersQuery } from './voucher.schema';
import { FiscalYearService } from '@/modules/fiscal-year/fiscal-year.service';
import { EntityManager } from 'typeorm';
import { TransactionSupportService } from '@/modules/transactions/transaction-support.service';

const VOUCHER_PREFIXES: Record<VoucherType, string> = {
  BRV: 'BRV', BPV: 'BPV', CRV: 'CRV', CPV: 'CPV',
  JV: 'JV', CV: 'CV', DN: 'DN', CN: 'CN',
};

export class VoucherService {
  private repo = AppDataSource.getRepository(Voucher);

  constructor(private companyId: string) {}

  /** Returns userId only if it is a valid UUID, otherwise undefined */
  private safeUuid(id: string | undefined): string | undefined {
    if (!id) return undefined;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? id
      : undefined;
  }

  /** Generate next voucher number: PV-2026-0001 */
  private async nextNumber(type: VoucherType, year: number, manager: EntityManager = AppDataSource.manager): Promise<string> {
    const prefix = `${VOUCHER_PREFIXES[type]}-${year}-`;
    const last = await manager
      .getRepository(Voucher)
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

  private validateVoucherLines(input: CreateVoucherInput): { totalDr: number; totalCr: number } {
    let totalDr = 0;
    let totalCr = 0;

    input.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (!line.account_code.trim()) throw new Error(`Account Code is required on line ${lineNumber}.`);
      if (!line.account_name.trim()) throw new Error(`Account Name is required on line ${lineNumber}.`);
      if (!Number.isFinite(line.dr_amount) || !Number.isFinite(line.cr_amount)) {
        throw new Error(`Debit and Credit must be valid numbers on line ${lineNumber}.`);
      }
      if (line.dr_amount < 0 || line.cr_amount < 0) {
        throw new Error(`Debit and Credit cannot be negative on line ${lineNumber}.`);
      }
      if (line.dr_amount === 0 && line.cr_amount === 0) {
        throw new Error(`Debit or Credit amount is required on line ${lineNumber}.`);
      }
      if (line.dr_amount > 0 && line.cr_amount > 0) {
        throw new Error(`Line ${lineNumber} cannot have both Debit and Credit amounts.`);
      }

      totalDr += line.dr_amount;
      totalCr += line.cr_amount;
    });

    if (totalDr <= 0 || totalCr <= 0) {
      throw new Error('Voucher must have both Debit and Credit amounts.');
    }
    if (Math.abs(totalDr - totalCr) > 0.001) {
      throw new Error(`Voucher is not balanced. Debit ${totalDr.toFixed(2)} does not match Credit ${totalCr.toFixed(2)}.`);
    }

    return { totalDr, totalCr };
  }

  private async validateSupportFields(input: CreateVoucherInput, voucherDate: Date) {
    const support = new TransactionSupportService(this.companyId);
    await support.validateActiveIds(
      'costCenter',
      input.lines.map(line => line.cost_center_id).filter(Boolean) as string[],
      'Cost Center',
    );
    await support.validateActiveIds(
      'project',
      input.lines.map(line => line.project_id).filter(Boolean) as string[],
      'Project',
    );
    await support.validateActiveIds(
      'department',
      input.lines.map(line => line.department_id).filter(Boolean) as string[],
      'Department',
    );

    if (input.auto_reverse_date) {
      const autoReverseDate = new Date(`${input.auto_reverse_date}T12:00:00`);
      if (Number.isNaN(autoReverseDate.getTime())) {
        throw new Error('Auto Reverse Date is not valid.');
      }
      if (autoReverseDate <= voucherDate) {
        throw new Error('Auto Reverse Date must be after Voucher Date.');
      }
    }
  }

  async createVoucher(input: CreateVoucherInput, userId: string): Promise<Voucher> {
    const date = new Date(`${input.voucher_date}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Voucher Date is not valid.');
    }
    const { totalDr, totalCr } = this.validateVoucherLines(input);
    await this.validateSupportFields(input, date);

    // Reject date outside any open fiscal year period
    await this.assertDateInOpenPeriod(date);

    return AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Voucher);
      const lineRepo = manager.getRepository(VoucherLine);
      const number = await this.nextNumber(input.voucher_type, date.getFullYear(), manager);

      const voucher = repo.create({
        company_id: this.companyId,
        voucher_number: number,
        voucher_type: input.voucher_type,
        voucher_date: date,
        reference: input.reference,
        narration: input.narration,
        status: 'Draft',
        approval_status: input.approval_status ?? 'Not Required',
        auto_reverse_date: input.auto_reverse_date ? new Date(`${input.auto_reverse_date}T12:00:00`) : undefined,
        reversal_status: input.auto_reverse_date ? 'Scheduled' : 'None',
        total_debit: String(totalDr),
        total_credit: String(totalCr),
        created_by: this.safeUuid(userId),
      });

      const saved = await repo.save(voucher);
      const lines = input.lines.map((line, index) =>
        lineRepo.create({
          voucher_id: saved.id,
          company_id: this.companyId,
          account_id: line.account_id,
          account_code: line.account_code,
          account_name: line.account_name,
          dr_amount: String(line.dr_amount),
          cr_amount: String(line.cr_amount),
          narration: line.narration,
          line_no: index + 1,
          cost_center_id: line.cost_center_id,
          project_id: line.project_id,
          department_id: line.department_id,
        }),
      );

      saved.lines = await lineRepo.save(lines);
      return saved;
    });
  }

  async postVoucher(id: string, userId: string): Promise<Voucher> {
    const voucher = await this.repo.findOne({
      where: { id, company_id: this.companyId },
      relations: ['lines'],
    });
    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status !== 'Draft') throw new Error('Only Draft vouchers can be posted');
    if (voucher.approval_status === 'Pending') throw new Error('Voucher is waiting for approval and cannot be posted.');
    if (voucher.approval_status === 'Rejected') throw new Error('Rejected voucher cannot be posted.');

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
