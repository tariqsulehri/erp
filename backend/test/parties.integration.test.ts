/**
 * Customer and Supplier tests against the real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env).
 * Everything happens inside a new test company that is deleted afterwards, so other companies are never touched.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, insertAccount, type TestCompany } from './support/test-database.js';

async function expectError(promise: Promise<unknown>, message: string | RegExp) {
  await expect(promise).rejects.toThrow(message);
}

describe.skipIf(!databaseUrl)('Customers and Suppliers (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let customers: InstanceType<typeof import('../src/modules/parties/customer.service.js')['CustomerService']>;
  let suppliers: InstanceType<typeof import('../src/modules/parties/supplier.service.js')['SupplierService']>;
  let schemas: typeof import('../src/modules/parties/party.schema.js');

  const customerInput = (body: Record<string, unknown>) => schemas.customerInputSchema.parse(body);
  const supplierInput = (body: Record<string, unknown>) => schemas.supplierInputSchema.parse(body);
  const accountOf = (id: string | null) => {
    expect(id, 'party has a linked account id').toBeTruthy();
    return prisma.account.findFirstOrThrow({ where: { companyId, id: id as string } });
  };

  beforeAll(async () => {
    company = await createTestCompany('Parties');
    prisma = company.prisma;
    companyId = company.companyId;
    schemas = await import('../src/modules/parties/party.schema.js');
    customers = new (await import('../src/modules/parties/customer.service.js')).CustomerService();
    suppliers = new (await import('../src/modules/parties/supplier.service.js')).SupplierService();
  }, 120000);

  afterAll(async () => {
    if (company) await company.cleanup();
    await prisma?.$disconnect();
  });

  describe('schemas', () => {
    it('requires a name and applies defaults', () => {
      expect(schemas.customerInputSchema.safeParse({ name: '   ' }).success).toBe(false);
      expect(schemas.supplierInputSchema.safeParse({}).success).toBe(false);

      const customer = customerInput({ name: 'Default Customer', currency_code: 'usd' });
      expect(customer).toMatchObject({
        customer_type: 'company', party_type: 'Customer', main_role: 'Customer',
        payment_terms_days: 30, credit_limit: 0, currency_code: 'USD', is_active: true,
      });
      const supplier = supplierInput({ name: 'Default Supplier' });
      expect(supplier).toMatchObject({ supplier_type: 'company', party_type: 'Supplier', main_role: 'Supplier', currency_code: 'PKR' });
    });

    it('rejects invalid values', () => {
      expect(schemas.customerInputSchema.safeParse({ name: 'X', email: 'not-an-email' }).success).toBe(false);
      expect(schemas.customerInputSchema.safeParse({ name: 'X', credit_limit: -1 }).success).toBe(false);
      expect(schemas.customerInputSchema.safeParse({ name: 'X', payment_terms_days: 400 }).success).toBe(false);
      expect(schemas.customerInputSchema.safeParse({ name: 'X', currency_code: 'RUPEE' }).success).toBe(false);
      expect(schemas.customerInputSchema.safeParse({ name: 'X', email: '' }).success).toBe(true);
    });

    it('allows "Customer And Supplier" only together with the matching main role', () => {
      expect(customerInput({ name: 'Both', party_type: 'Customer And Supplier' }).party_type).toBe('Customer And Supplier');
      expect(schemas.customerInputSchema.safeParse({ name: 'X', party_type: 'Supplier' }).success).toBe(false);
      expect(schemas.customerInputSchema.safeParse({ name: 'X', main_role: 'Supplier' }).success).toBe(false);
      expect(supplierInput({ name: 'Both', party_type: 'Customer And Supplier' }).party_type).toBe('Customer And Supplier');
      expect(schemas.supplierInputSchema.safeParse({ name: 'X', party_type: 'Customer' }).success).toBe(false);
    });

    // BUG: partyListQuerySchema (src/modules/parties/party.schema.ts) uses z.coerce.boolean() for is_active.
    // Query strings are text, and Boolean('false') is true, so GET /customers?is_active=false (and /suppliers)
    // returns the ACTIVE parties instead of the inactive ones. It should read 'false' as false.
    it('reads is_active=false from the query string as false', () => {
      expect(schemas.partyListQuerySchema.parse({ is_active: 'false' }).is_active).toBe(false);
    });
  });

  describe('customers', () => {
    it('creates a customer with a linked receivable account at the start of 0103010001-0103999999', async () => {
      expect(await customers.nextCode(companyId)).toBe('CUS-0001');
      const created = await customers.create(companyId, customerInput({
        name: 'Alpha Traders', email: ' alpha@example.com ', phone: '0300-1111111', credit_limit: 50000, payment_terms_days: 15,
        billing_address: '  ', notes: 'Key account',
      }));

      expect(created).toMatchObject({
        company_id: companyId, code: 'CUS-0001', name: 'Alpha Traders', email: 'alpha@example.com', billing_address: null,
        credit_limit: 50000, payment_terms_days: 15, main_role: 'Customer', party_type: 'Customer', is_active: true, notes: 'Key account',
      });
      const account = await accountOf(created.ar_account_id);
      expect(account).toMatchObject({
        code: '0103010001', name: 'Alpha Traders', accountType: 'Asset', normalBalance: 'Debit',
        isPosting: true, isSystem: false, isActive: true, description: 'Customer linked account - Alpha Traders',
      });
    });

    it('generates customer codes and linked account codes in sequence', async () => {
      const second = await customers.create(companyId, customerInput({ name: 'Beta Stores' }));
      const third = await customers.create(companyId, customerInput({ name: 'Gamma Mart', customer_type: 'individual' }));
      expect([second.code, third.code]).toEqual(['CUS-0002', 'CUS-0003']);
      expect((await accountOf(second.ar_account_id)).code).toBe('0103010002');
      expect((await accountOf(third.ar_account_id)).code).toBe('0103010003');
      expect(await customers.nextCode(companyId)).toBe('CUS-0004');
    });

    it('skips linked account codes already used in the customer range', async () => {
      await insertAccount(prisma, companyId, '0103010004', 'Manually Created Receivable', 'Asset', 'Debit');
      const created = await customers.create(companyId, customerInput({ name: 'Delta Co' }));
      expect((await accountOf(created.ar_account_id)).code).toBe('0103010005');
      const customerRangeCodes = (await prisma.account.findMany({ where: { companyId, code: { startsWith: '0103' } }, select: { code: true } }))
        .map(row => row.code);
      expect(customerRangeCodes.every(code => code >= '0103010001' && code <= '0103999999')).toBe(true);
    });

    it('uses a given code in upper case and rejects a duplicate code without creating an account', async () => {
      const created = await customers.create(companyId, customerInput({ code: ' vip-01 ', name: 'Vip Buyer' }));
      expect(created.code).toBe('VIP-01');

      const accountsBefore = await prisma.account.count({ where: { companyId } });
      await expectError(customers.create(companyId, customerInput({ code: 'Vip-01', name: 'Another Vip' })), 'Customer Code "VIP-01" already exists.');
      expect(await prisma.account.count({ where: { companyId } })).toBe(accountsBefore);
      expect(await prisma.customer.count({ where: { companyId, code: 'VIP-01' } })).toBe(1);
    });

    it('uses a supplied receivable account instead of creating a new one', async () => {
      const existingAccountId = await insertAccount(prisma, companyId, '0103020001', 'Shared Receivable', 'Asset', 'Debit');
      const accountsBefore = await prisma.account.count({ where: { companyId } });
      const created = await customers.create(companyId, customerInput({ name: 'Group Member', ar_account_id: existingAccountId }));
      expect(created.ar_account_id).toBe(existingAccountId);
      expect(await prisma.account.count({ where: { companyId } })).toBe(accountsBefore);
    });

    it('stores the "Customer And Supplier" party type and keeps the main role as Customer', async () => {
      const created = await customers.create(companyId, customerInput({ name: 'Two Way Co', party_type: 'Customer And Supplier' }));
      expect(created).toMatchObject({ party_type: 'Customer And Supplier', main_role: 'Customer' });
      const updated = await customers.update(companyId, created.id, { party_type: 'Customer' });
      expect(updated).toMatchObject({ party_type: 'Customer', main_role: 'Customer' });
    });

    it('updates fields, renames the linked account and leaves untouched fields alone', async () => {
      const alpha = await prisma.customer.findFirstOrThrow({ where: { companyId, code: 'CUS-0001' } });
      const updated = await customers.update(companyId, alpha.id, schemas.updateCustomerInputSchema.parse({
        name: 'Alpha Traders Ltd', credit_limit: 75000, city: 'Lahore',
      }));
      expect(updated).toMatchObject({ name: 'Alpha Traders Ltd', credit_limit: 75000, city: 'Lahore', email: 'alpha@example.com', payment_terms_days: 15 });

      const account = await accountOf(alpha.arAccountId);
      expect(account.name).toBe('Alpha Traders Ltd');
      expect(account.description).toBe('Customer linked account - Alpha Traders Ltd');
      expect(account.code).toBe('0103010001');
    });

    it('rejects changing the code to one already used and returns not found for other ids', async () => {
      const beta = await prisma.customer.findFirstOrThrow({ where: { companyId, code: 'CUS-0002' } });
      await expectError(customers.update(companyId, beta.id, { code: 'cus-0001' }), 'Customer Code "CUS-0001" already exists.');
      await expectError(customers.update(companyId, '00000000-0000-4000-8000-000000000000', { name: 'Ghost' }), 'Customer was not found.');
    });

    it('marks a customer inactive and filters the list by status', async () => {
      const gamma = await prisma.customer.findFirstOrThrow({ where: { companyId, code: 'CUS-0003' } });
      await customers.deactivate(companyId, gamma.id);
      expect((await prisma.customer.findUniqueOrThrow({ where: { id: gamma.id } })).isActive).toBe(false);
      // Deactivating keeps the linked account so its history stays.
      expect((await accountOf(gamma.arAccountId)).isActive).toBe(true);

      const activeOnly = await customers.list(companyId, schemas.partyListQuerySchema.parse({ is_active: 'true' }));
      expect(activeOnly.data.some(row => row.id === gamma.id)).toBe(false);
      const inactiveOnly = await customers.list(companyId, { ...schemas.partyListQuerySchema.parse({}), is_active: false });
      expect(inactiveOnly.data.map(row => row.id)).toEqual([gamma.id]);

      const stats = await customers.stats(companyId);
      expect(stats.inactive).toBe(1);
      expect(stats.total).toBe(stats.active + stats.inactive);
      expect(stats.total_credit_limit).toBe(75000);
    });

    it('lists with search, type filter, name order, pagination and linked account details', async () => {
      const all = await customers.list(companyId, schemas.partyListQuerySchema.parse({ limit: 200 }));
      const names = all.data.map(row => row.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(all.total).toBe(all.data.length);

      const firstPage = await customers.list(companyId, schemas.partyListQuerySchema.parse({ limit: 2, page: 1 }));
      const secondPage = await customers.list(companyId, schemas.partyListQuerySchema.parse({ limit: 2, page: 2 }));
      expect(firstPage.data).toHaveLength(2);
      expect(firstPage.total).toBe(all.total);
      expect(secondPage.data[0].id).toBe(all.data[2].id);

      const search = await customers.list(companyId, schemas.partyListQuerySchema.parse({ search: 'ALPHA@example' }));
      expect(search.data.map(row => row.code)).toEqual(['CUS-0001']);
      expect(search.data[0]).toMatchObject({ ar_account_code: '0103010001', ar_account_name: 'Alpha Traders Ltd' });

      const byCode = await customers.list(companyId, schemas.partyListQuerySchema.parse({ search: 'vip' }));
      expect(byCode.data.map(row => row.code)).toEqual(['VIP-01']);

      const individuals = await customers.list(companyId, schemas.partyListQuerySchema.parse({ type: 'individual' }));
      expect(individuals.data.map(row => row.name)).toEqual(['Gamma Mart']);
    });

    // BUG: CustomerService.nextCode (src/modules/parties/customer.service.ts) finds the "last" code with
    // `orderBy: { code: 'desc' }`, which is a text sort. After CUS-9999 the next code is CUS-10000, but
    // "CUS-9999" still sorts after "CUS-10000", so the next suggested code is CUS-10000 again and creating
    // a customer without a code fails with a duplicate error. The same applies to SupplierService.nextCode.
    it('keeps generating new customer codes after CUS-9999', async () => {
      await customers.create(companyId, customerInput({ code: 'CUS-9999', name: 'Last Four Digit Customer' }));
      const tenThousand = await customers.create(companyId, customerInput({ name: 'Customer Ten Thousand' }));
      expect(tenThousand.code).toBe('CUS-10000');
      const next = await customers.create(companyId, customerInput({ name: 'Customer Ten Thousand One' }));
      expect(next.code).toBe('CUS-10001');
    });

    // BUG: CustomerService.create accepts any uuid as ar_account_id without checking that the account exists in
    // this company and is an active posting receivable account (customers.ar_account_id has no foreign key).
    // A customer can therefore be linked to a missing account, and sales/receipts for it cannot post.
    it('rejects a receivable account id that does not exist in the company', async () => {
      await expect(customers.create(companyId, customerInput({
        code: 'BROKEN-01', name: 'Broken Link Customer', ar_account_id: '00000000-0000-4000-8000-000000000001',
      }))).rejects.toThrow();
    });
  });

  describe('suppliers', () => {
    it('creates a supplier with a linked payable account at the start of 0201010001-0201999999', async () => {
      expect(await suppliers.nextCode(companyId)).toBe('SUP-0001');
      const created = await suppliers.create(companyId, supplierInput({
        name: 'Prime Supplies', bank_name: 'Test Bank', bank_iban: 'PK00TEST0000000000000000', address: 'Industrial Area',
      }));
      expect(created).toMatchObject({
        company_id: companyId, code: 'SUP-0001', name: 'Prime Supplies', main_role: 'Supplier', party_type: 'Supplier',
        bank_name: 'Test Bank', bank_iban: 'PK00TEST0000000000000000', address: 'Industrial Area', is_active: true,
      });
      const account = await accountOf(created.ap_account_id);
      expect(account).toMatchObject({
        code: '0201010001', name: 'Prime Supplies', accountType: 'Liability', normalBalance: 'Credit',
        isPosting: true, description: 'Supplier linked account - Prime Supplies',
      });
    });

    it('generates supplier codes and payable account codes in sequence, separate from customers', async () => {
      const second = await suppliers.create(companyId, supplierInput({ name: 'Second Supplier', party_type: 'Customer And Supplier' }));
      expect(second).toMatchObject({ code: 'SUP-0002', party_type: 'Customer And Supplier', main_role: 'Supplier' });
      expect((await accountOf(second.ap_account_id)).code).toBe('0201010002');
      expect(await suppliers.nextCode(companyId)).toBe('SUP-0003');

      // Supplier accounts never use the customer range.
      const supplierAccounts = await prisma.account.findMany({
        where: { companyId, id: { in: (await prisma.supplier.findMany({ where: { companyId }, select: { apAccountId: true } })).map(row => row.apAccountId!) } },
        select: { code: true },
      });
      expect(supplierAccounts.every(row => row.code >= '0201010001' && row.code <= '0201999999')).toBe(true);
    });

    it('moves to the next sub group when a payable sub group is full', async () => {
      // Fill 0201010003 - 0201019999 so the next free code is in sub group 02.
      await prisma.$executeRaw`
        INSERT INTO accounts (company_id, code, name, account_type, normal_balance, is_posting, is_active, updated_at)
        SELECT CAST(${companyId} AS uuid), '020101' || lpad(n::text, 4, '0'), 'Filler ' || n, 'Liability', 'Credit', true, true, now()
        FROM generate_series(3, 9999) AS n
      `;
      const created = await suppliers.create(companyId, supplierInput({ name: 'Overflow Supplier' }));
      expect((await accountOf(created.ap_account_id)).code).toBe('0201020001');
      await prisma.$executeRaw`DELETE FROM accounts WHERE company_id = CAST(${companyId} AS uuid) AND name LIKE 'Filler %'`;
    });

    it('rejects a duplicate supplier code', async () => {
      await expectError(suppliers.create(companyId, supplierInput({ code: 'sup-0001', name: 'Copy' })), 'Supplier Code "SUP-0001" already exists.');
      expect(await prisma.supplier.count({ where: { companyId, code: 'SUP-0001' } })).toBe(1);
    });

    it('updates a supplier, renames its payable account and can mark it inactive', async () => {
      const prime = await prisma.supplier.findFirstOrThrow({ where: { companyId, code: 'SUP-0001' } });
      const updated = await suppliers.update(companyId, prime.id, schemas.updateSupplierInputSchema.parse({
        name: 'Prime Supplies Pvt', payment_terms_days: 45, bank_account_no: '000123', is_active: false,
      }));
      expect(updated).toMatchObject({ name: 'Prime Supplies Pvt', payment_terms_days: 45, bank_account_no: '000123', bank_name: 'Test Bank', is_active: false });
      expect((await accountOf(prime.apAccountId)).name).toBe('Prime Supplies Pvt');

      await expectError(suppliers.update(companyId, '00000000-0000-4000-8000-000000000000', { name: 'Ghost' }), 'Supplier was not found.');
      const second = await prisma.supplier.findFirstOrThrow({ where: { companyId, code: 'SUP-0002' } });
      await expectError(suppliers.update(companyId, second.id, { code: 'SUP-0001' }), 'Supplier Code "SUP-0001" already exists.');
    });

    it('lists, searches and reports stats for suppliers', async () => {
      const active = await suppliers.list(companyId, schemas.partyListQuerySchema.parse({ is_active: 'true' }));
      expect(active.data.every(row => row.is_active)).toBe(true);
      expect(active.data.some(row => row.code === 'SUP-0001')).toBe(false);

      const search = await suppliers.list(companyId, schemas.partyListQuerySchema.parse({ search: 'overflow' }));
      expect(search.data.map(row => row.name)).toEqual(['Overflow Supplier']);

      const paged = await suppliers.list(companyId, schemas.partyListQuerySchema.parse({ limit: 1, page: 2 }));
      expect(paged).toMatchObject({ total: 3, page: 2, limit: 1 });
      expect(paged.data).toHaveLength(1);

      expect(await suppliers.stats(companyId)).toEqual({ total: 3, active: 2, inactive: 1, with_bank_details: 1 });
    });
  });
});
