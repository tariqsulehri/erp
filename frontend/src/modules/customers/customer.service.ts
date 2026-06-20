import { AppDataSource }    from '@/db/data-source';
import { Customer }          from './customer.entity';
import { Account }           from '@/modules/accounts/account.entity';
import { EntityManager }     from 'typeorm';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersQuery,
} from './customer.schema';
import {
  CUSTOMER_ACCOUNT_CODE_END,
  CUSTOMER_ACCOUNT_CODE_PREFIX,
  CUSTOMER_ACCOUNT_CODE_START,
  PARTY_ACCOUNT_SUBGROUP_MAX,
  PARTY_ACCOUNT_SUBGROUP_MIN,
  POSTING_ACCOUNT_MAX,
  POSTING_ACCOUNT_MIN,
  buildPostingAccountCode,
} from '@/modules/accounts/account-code';

/**
 * CustomerService — AR sub-ledger master CRUD.
 *
 * All methods are scoped to companyId. No cross-company data leaks.
 *
 * Code sequencing: CUS-0001, CUS-0002 …
 *   Auto-generated unless caller provides an explicit code.
 *   Sequence is company-scoped (each company restarts at 0001).
 *
 * GL Account auto-assignment:
 *   When a customer is created, a GL posting account is automatically created
 *   in the customer linked account range and linked via ar_account_id.
 *   Range: 10-digit codes 0103010001–0103999999.
 *   Total capacity: 989,901 customer linked accounts per company.
 */
export class CustomerService {
  private repo     = AppDataSource.getRepository(Customer);
  private acctRepo = AppDataSource.getRepository(Account);

  constructor(private companyId: string) {}

  /* ── Customer code generator ─────────────────────────────────── */
  async nextCode(manager: EntityManager = AppDataSource.manager): Promise<string> {
    const last = await manager.getRepository(Customer)
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

  /* ── GL account helpers ──────────────────────────────────────── */

  /**
   * Return the next unused 10-digit account code in the customer linked account
   * range 0103010001–0103999999.
   */
  async nextArAccountCode(manager: EntityManager = AppDataSource.manager): Promise<string> {
    const rows = await manager.getRepository(Account)
      .createQueryBuilder('a')
      .select('a.code')
      .where('a.company_id = :cid', { cid: this.companyId })
      .andWhere('a.code BETWEEN :start AND :end', {
        start: CUSTOMER_ACCOUNT_CODE_START,
        end: CUSTOMER_ACCOUNT_CODE_END,
      })
      .getMany();

    const used = new Set(rows.map(r => r.code));
    for (let subgroup = PARTY_ACCOUNT_SUBGROUP_MIN; subgroup <= PARTY_ACCOUNT_SUBGROUP_MAX; subgroup++) {
      for (let posting = POSTING_ACCOUNT_MIN; posting <= POSTING_ACCOUNT_MAX; posting++) {
        const code = buildPostingAccountCode(CUSTOMER_ACCOUNT_CODE_PREFIX, subgroup, posting);
        if (!used.has(code)) return code;
      }
    }
    throw new Error(
      'Customer linked account range (0103010001–0103999999) is exhausted. ' +
      'Contact your accountant to extend the chart of accounts.',
    );
  }

  /**
   * Create a GL posting account for the AR sub-ledger and return its id + code.
   * Account type: Asset / Debit-normal / is_posting = true.
   */
  async createArSubledgerAccount(customerName: string, manager: EntityManager = AppDataSource.manager): Promise<{ id: string; code: string }> {
    const code = await this.nextArAccountCode(manager);
    const accountRepo = manager.getRepository(Account);
    const acct = accountRepo.create({
      company_id:     this.companyId,
      code,
      name:           `${customerName}`.slice(0, 100),
      account_type:   'Asset',
      normal_balance: 'Debit',
      is_posting:     true,
      is_system:      false,
      is_active:      true,
      description:    `Customer linked account - ${customerName}`,
    });
    const saved = await accountRepo.save(acct);
    return { id: saved.id, code: saved.code };
  }

  private normalizePartyRole(input: Pick<CreateCustomerInput, 'party_type' | 'main_role'>) {
    const partyType = input.party_type ?? 'Customer';
    if (partyType === 'Supplier') {
      throw new Error('Use the Supplier screen for parties whose main record is Supplier.');
    }
    return {
      party_type: partyType,
      main_role: 'Customer' as const,
    };
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
    return AppDataSource.transaction(async manager => {
      const customerRepo = manager.getRepository(Customer);
      const code = input.code?.trim().toUpperCase() || await this.nextCode(manager);
      const roleFields = this.normalizePartyRole(input);

      /* Unique code guard */
      const exists = await customerRepo.findOne({
        where: { company_id: this.companyId, code },
        select: ['id'],
      });
      if (exists) throw new Error(`Customer code "${code}" already exists.`);

      /* Auto-create one linked GL account if caller did not supply one */
      let arAccountId = input.ar_account_id;
      if (!arAccountId) {
        const gl = await this.createArSubledgerAccount(input.name, manager);
        arAccountId = gl.id;
      }

      const customer = customerRepo.create({
        ...input,
        ...roleFields,
        code,
        company_id:          this.companyId,
        ar_account_id:       arAccountId,
        email:               input.email               || undefined,
        trade_name:          input.trade_name           || undefined,
        tax_registration_no: input.tax_registration_no || undefined,
      });
      return customerRepo.save(customer);
    });
  }

  /* ── Update ──────────────────────────────────────────────────── */
  async update(input: UpdateCustomerInput): Promise<Customer> {
    const { id, ...rest } = input;
    const customer = await this.get(id);
    const roleFields = this.normalizePartyRole({
      party_type: rest.party_type ?? customer.party_type,
      main_role: rest.main_role ?? customer.main_role,
    });

    /* If code is being changed, check uniqueness */
    if (rest.code && rest.code !== customer.code) {
      const conflict = await this.repo.findOne({
        where: { company_id: this.companyId, code: rest.code.toUpperCase() },
        select: ['id'],
      });
      if (conflict) throw new Error(`Customer code "${rest.code}" already exists.`);
      rest.code = rest.code.toUpperCase();
    }

    /* If name changed and a GL account is linked, keep its name in sync */
    if (rest.name && rest.name !== customer.name && customer.ar_account_id) {
      await this.acctRepo.update(
        { id: customer.ar_account_id, company_id: this.companyId },
        { name: rest.name.slice(0, 100), description: `Customer linked account - ${rest.name}` },
      );
    }

    Object.assign(customer, rest, roleFields);
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
