import { AppDataSource }    from '@/db/data-source';
import { Supplier }          from './supplier.entity';
import { Account }           from '@/modules/accounts/account.entity';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
  ListSuppliersQuery,
} from './supplier.schema';

/**
 * SupplierService — AP sub-ledger master CRUD.
 *
 * All methods are scoped to companyId. No cross-company data leaks.
 *
 * Code sequencing: SUP-0001, SUP-0002 …
 *   Auto-generated unless caller provides an explicit code.
 *   Sequence is company-scoped (each company restarts at 0001).
 *
 * GL Account auto-assignment:
 *   When a supplier is created, a GL posting account is automatically created
 *   in the AP sub-ledger range (2101–2199) and linked via ap_account_id.
 *   Range: 7-digit codes 2100001–2199999 (column widened to VARCHAR(10) by
 *   migration 9 alongside the switch to 6-digit main COA codes).
 *   Total capacity: 99,999 supplier sub-ledger accounts per company.
 */
export class SupplierService {
  private repo     = AppDataSource.getRepository(Supplier);
  private acctRepo = AppDataSource.getRepository(Account);

  constructor(private companyId: string) {}

  /* ── GL account helpers ──────────────────────────────────────── */

  /**
   * Return the next unused 7-digit GL code in the AP sub-ledger range
   * 2100001–2199999.  7-digit codes are never COA hierarchy pivots, so no
   * skipping is needed.  Capacity: 99,999 supplier accounts per company.
   */
  async nextApAccountCode(): Promise<string> {
    const rows = await this.acctRepo
      .createQueryBuilder('a')
      .select('a.code')
      .where('a.company_id = :cid', { cid: this.companyId })
      .andWhere('CAST(a.code AS BIGINT) BETWEEN 2100001 AND 2199999')
      .getMany();

    const used = new Set(rows.map(r => parseInt(r.code, 10)));
    for (let n = 2100001; n <= 2199999; n++) {
      if (!used.has(n)) return String(n);
    }
    throw new Error(
      'AP sub-ledger code range (2100001–2199999) is exhausted. ' +
      'Contact your accountant to extend the chart of accounts.',
    );
  }

  /**
   * Create a GL posting account for the AP sub-ledger and return its id + code.
   * Account type: Liability / Credit-normal / is_posting = true.
   */
  async createApSubledgerAccount(supplierName: string): Promise<{ id: string; code: string }> {
    const code = await this.nextApAccountCode();
    const acct = this.acctRepo.create({
      company_id:     this.companyId,
      code,
      name:           `${supplierName}`.slice(0, 100),
      account_type:   'Liability',
      normal_balance: 'Credit',
      is_posting:     true,
      is_system:      false,
      is_active:      true,
      description:    `AP sub-ledger — ${supplierName}`,
    });
    const saved = await this.acctRepo.save(acct);
    return { id: saved.id, code: saved.code };
  }

  /* ── Supplier code generator ─────────────────────────────────── */
  async nextCode(): Promise<string> {
    const last = await this.repo
      .createQueryBuilder('s')
      .select('s.code')
      .where('s.company_id = :cid', { cid: this.companyId })
      .andWhere('s.code ILIKE :p',  { p: 'SUP-%' })
      .orderBy('s.code', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const n = parseInt(last.code.split('-').pop() ?? '0', 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `SUP-${String(seq).padStart(4, '0')}`;
  }

  /* ── List ────────────────────────────────────────────────────── */
  async list(q: ListSuppliersQuery) {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.company_id = :cid', { cid: this.companyId });

    if (q.is_active !== undefined)
      qb.andWhere('s.is_active = :a', { a: q.is_active });

    if (q.supplier_type)
      qb.andWhere('s.supplier_type = :t', { t: q.supplier_type });

    if (q.search?.trim()) {
      const s = `%${q.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(lower(s.name) LIKE :s OR lower(s.code) LIKE :s OR lower(s.email) LIKE :s OR lower(s.phone) LIKE :s)',
        { s },
      );
    }

    qb.orderBy('s.name', 'ASC');

    const limit  = q.limit  ?? 50;
    const offset = ((q.page ?? 1) - 1) * limit;
    const [data, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return { data, total, page: q.page ?? 1, limit };
  }

  /* ── Get single ──────────────────────────────────────────────── */
  async get(id: string): Promise<Supplier> {
    const s = await this.repo.findOne({
      where: { id, company_id: this.companyId },
    });
    if (!s) throw new Error('Supplier not found.');
    return s;
  }

  /* ── Create ──────────────────────────────────────────────────── */
  async create(input: CreateSupplierInput): Promise<Supplier> {
    const code = input.code?.trim().toUpperCase() || await this.nextCode();

    const exists = await this.repo.findOne({
      where: { company_id: this.companyId, code },
      select: ['id'],
    });
    if (exists) throw new Error(`Supplier code "${code}" already exists.`);

    /* Auto-create GL sub-ledger account if caller did not supply one */
    let apAccountId = input.ap_account_id;
    if (!apAccountId) {
      const gl = await this.createApSubledgerAccount(input.name);
      apAccountId = gl.id;
    }

    const supplier = this.repo.create({
      ...input,
      code,
      company_id:          this.companyId,
      ap_account_id:       apAccountId,
      email:               input.email               || undefined,
      trade_name:          input.trade_name           || undefined,
      tax_registration_no: input.tax_registration_no || undefined,
      bank_name:           input.bank_name            || undefined,
      bank_account_no:     input.bank_account_no      || undefined,
      bank_swift_code:     input.bank_swift_code      || undefined,
      bank_iban:           input.bank_iban            || undefined,
    });
    return this.repo.save(supplier);
  }

  /* ── Update ──────────────────────────────────────────────────── */
  async update(input: UpdateSupplierInput): Promise<Supplier> {
    const { id, ...rest } = input;
    const supplier = await this.get(id);

    if (rest.code && rest.code !== supplier.code) {
      const conflict = await this.repo.findOne({
        where: { company_id: this.companyId, code: rest.code.toUpperCase() },
        select: ['id'],
      });
      if (conflict) throw new Error(`Supplier code "${rest.code}" already exists.`);
      rest.code = rest.code.toUpperCase();
    }

    /* If name changed and a GL account is linked, keep its name in sync */
    if (rest.name && rest.name !== supplier.name && supplier.ap_account_id) {
      await this.acctRepo.update(
        { id: supplier.ap_account_id, company_id: this.companyId },
        { name: rest.name.slice(0, 100), description: `AP sub-ledger — ${rest.name}` },
      );
    }

    Object.assign(supplier, rest);
    return this.repo.save(supplier);
  }

  /* ── Delete ──────────────────────────────────────────────────── */
  async delete(id: string): Promise<void> {
    const supplier = await this.get(id);
    /* Guard: no purchase bills / payments referencing this supplier yet.
       When Purchase module is built, add checks here. */
    await this.repo.remove(supplier);
  }

  /* ── Stats (for KPI chips) ───────────────────────────────────── */
  async stats() {
    const [total, active, inactive, with_bank_details] = await Promise.all([
      this.repo.count({ where: { company_id: this.companyId } }),
      this.repo.count({ where: { company_id: this.companyId, is_active: true  } }),
      this.repo.count({ where: { company_id: this.companyId, is_active: false } }),
      this.repo
        .createQueryBuilder('s')
        .where('s.company_id = :cid', { cid: this.companyId })
        .andWhere('(s.bank_account_no IS NOT NULL OR s.bank_iban IS NOT NULL)')
        .getCount(),
    ]);
    return { total, active, inactive, with_bank_details };
  }
}
