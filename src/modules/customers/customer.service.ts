import { AppDataSource }    from '@/db/data-source';
import { Customer }          from './customer.entity';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersQuery,
} from './customer.schema';

/**
 * CustomerService — AR sub-ledger master CRUD.
 *
 * All methods are scoped to companyId. No cross-company data leaks.
 *
 * Code sequencing: CUS-0001, CUS-0002 …
 *   Auto-generated unless caller provides an explicit code.
 *   Sequence is company-scoped (each company restarts at 0001).
 */
export class CustomerService {
  private repo = AppDataSource.getRepository(Customer);

  constructor(private companyId: string) {}

  /* ── Code generator ─────────────────────────────────────────── */
  async nextCode(): Promise<string> {
    const last = await this.repo
      .createQueryBuilder('c')
      .select('c.code')
      .where('c.company_id = :cid', { cid: this.companyId })
      .andWhere('c.code ILIKE :p',  { p: 'CUS-%' })
      .orderBy('c.code', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const n = parseInt(last.code.split('-').pop() ?? '0', 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `CUS-${String(seq).padStart(4, '0')}`;
  }

  /* ── List ────────────────────────────────────────────────────── */
  async list(q: ListCustomersQuery) {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.company_id = :cid', { cid: this.companyId });

    if (q.is_active !== undefined)
      qb.andWhere('c.is_active = :a', { a: q.is_active });

    if (q.customer_type)
      qb.andWhere('c.customer_type = :t', { t: q.customer_type });

    if (q.search?.trim()) {
      const s = `%${q.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(lower(c.name) LIKE :s OR lower(c.code) LIKE :s OR lower(c.email) LIKE :s OR lower(c.phone) LIKE :s)',
        { s },
      );
    }

    qb.orderBy('c.name', 'ASC');

    const limit  = q.limit  ?? 50;
    const offset = ((q.page ?? 1) - 1) * limit;
    const [data, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return { data, total, page: q.page ?? 1, limit };
  }

  /* ── Get single ──────────────────────────────────────────────── */
  async get(id: string): Promise<Customer> {
    const c = await this.repo.findOne({
      where: { id, company_id: this.companyId },
    });
    if (!c) throw new Error('Customer not found.');
    return c;
  }

  /* ── Create ──────────────────────────────────────────────────── */
  async create(input: CreateCustomerInput): Promise<Customer> {
    const code = input.code?.trim().toUpperCase() || await this.nextCode();

    /* Unique code guard */
    const exists = await this.repo.findOne({
      where: { company_id: this.companyId, code },
      select: ['id'],
    });
    if (exists) throw new Error(`Customer code "${code}" already exists.`);

    const customer = this.repo.create({
      ...input,
      code,
      company_id:   this.companyId,
      email:        input.email     || undefined,
      trade_name:   input.trade_name|| undefined,
      tax_registration_no: input.tax_registration_no || undefined,
    });
    return this.repo.save(customer);
  }

  /* ── Update ──────────────────────────────────────────────────── */
  async update(input: UpdateCustomerInput): Promise<Customer> {
    const { id, ...rest } = input;
    const customer = await this.get(id);

    /* If code is being changed, check uniqueness */
    if (rest.code && rest.code !== customer.code) {
      const conflict = await this.repo.findOne({
        where: { company_id: this.companyId, code: rest.code.toUpperCase() },
        select: ['id'],
      });
      if (conflict) throw new Error(`Customer code "${rest.code}" already exists.`);
      rest.code = rest.code.toUpperCase();
    }

    Object.assign(customer, rest);
    return this.repo.save(customer);
  }

  /* ── Delete ──────────────────────────────────────────────────── */
  async delete(id: string): Promise<void> {
    const customer = await this.get(id);

    /* Guard: no transactions referencing this customer yet.
       When Sales Invoice / Receipt modules are built, add checks here. */

    await this.repo.remove(customer);
  }

  /* ── Stats (for KPI chips) ───────────────────────────────────── */
  async stats() {
    const [total, active, inactive] = await Promise.all([
      this.repo.count({ where: { company_id: this.companyId } }),
      this.repo.count({ where: { company_id: this.companyId, is_active: true  } }),
      this.repo.count({ where: { company_id: this.companyId, is_active: false } }),
    ]);

    const creditResult = await this.repo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.credit_limit), 0)', 'total')
      .where('c.company_id = :cid AND c.is_active = true', { cid: this.companyId })
      .getRawOne<{ total: string }>();

    return {
      total,
      active,
      inactive,
      total_credit_limit: parseFloat(creditResult?.total ?? '0'),
    };
  }
}
