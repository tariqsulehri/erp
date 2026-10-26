/**
 * Chart of Accounts tests against the real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env).
 * Everything happens inside a new test company that is deleted afterwards, so other companies are never touched.
 */
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

async function expectBusinessError(promise: Promise<unknown>, message: string | RegExp, statusCode = 400) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected the call to throw').toBeInstanceOf(Error);
  const error = caught as Error & { statusCode?: number };
  if (typeof message === 'string') expect(error.message).toBe(message);
  else expect(error.message).toMatch(message);
  expect(error.statusCode).toBe(statusCode);
}

describe.skipIf(!databaseUrl)('Chart of Accounts (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let accounts: InstanceType<typeof import('../src/modules/accounts/account-list.service.js')['AccountListService']>;
  let schemas: typeof import('../src/modules/accounts/account.schema.js');
  let FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
  let insertPostedVoucher: typeof import('../src/modules/vouchers/voucher-posting.js')['insertPostedVoucher'];

  const header = (code: string, name: string, type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense', normal: 'Debit' | 'Credit') =>
    schemas.createAccountSchema.parse({ code, name, account_type: type, normal_balance: normal, is_posting: false });
  const posting = (code: string, name: string, type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense', normal: 'Debit' | 'Credit', extra: Record<string, unknown> = {}) =>
    schemas.createAccountSchema.parse({ code, name, account_type: type, normal_balance: normal, is_posting: true, ...extra });

  const byCode = async (code: string) => prisma.account.findFirstOrThrow({ where: { companyId, code } });

  beforeAll(async () => {
    company = await createTestCompany('Accounts');
    prisma = company.prisma;
    companyId = company.companyId;
    const { AccountListService } = await import('../src/modules/accounts/account-list.service.js');
    schemas = await import('../src/modules/accounts/account.schema.js');
    FiscalYearService = (await import('../src/modules/fiscal-years/fiscal-year.service.js')).FiscalYearService;
    insertPostedVoucher = (await import('../src/modules/vouchers/voucher-posting.js')).insertPostedVoucher;
    accounts = new AccountListService();

    // Base tree used by most tests: Assets > Current Assets > Cash group, Liabilities > Payables group.
    await accounts.create(companyId, header('0100000000', 'Assets', 'Asset', 'Debit'));
    await accounts.create(companyId, header('0101000000', 'Current Assets', 'Asset', 'Debit'));
    await accounts.create(companyId, header('0101010000', 'Cash And Bank', 'Asset', 'Debit'));
    await accounts.create(companyId, header('0200000000', 'Liabilities', 'Liability', 'Credit'));
    await accounts.create(companyId, header('0202000000', 'Current Liabilities', 'Liability', 'Credit'));
    await accounts.create(companyId, header('0202010000', 'Payables', 'Liability', 'Credit'));
  }, 120000);

  afterAll(async () => {
    if (company) await company.cleanup();
    await prisma?.$disconnect();
  });

  describe('create and code rules', () => {
    it('creates a posting account under an existing header and writes a "created" audit log', async () => {
      const result = await accounts.create(companyId, posting('0101010001', 'Cash In Hand', 'Asset', 'Debit', { description: '  Main till  ' }));

      expect(result.success).toBe(true);
      expect(result.message).toBe('Account 0101010001 created successfully.');
      expect(result.account).toMatchObject({
        code: '0101010001',
        name: 'Cash In Hand',
        description: 'Main till',
        account_type: 'Asset',
        normal_balance: 'Debit',
        is_posting: true,
        is_system: false,
        is_active: true,
        company_id: companyId,
      });

      const logs = await prisma.accountAuditLog.findMany({ where: { companyId, accountId: result.account.id } });
      expect(logs.map(log => log.action)).toEqual(['created']);
    });

    it('rejects codes that are not exactly 10 digits (schema and service)', async () => {
      for (const code of ['123', '01010100011', '01010A0001', '']) {
        const parsed = schemas.createAccountSchema.safeParse({ code, name: 'Bad', account_type: 'Asset', normal_balance: 'Debit' });
        expect(parsed.success).toBe(false);
      }
      // The service checks again when called without the schema.
      await expectBusinessError(
        accounts.create(companyId, { code: '12345', name: 'Bad', account_type: 'Asset', normal_balance: 'Debit', is_posting: true, is_system: false }),
        'Account Code must be exactly 10 digits.',
      );
      expect(await accounts.validateCode(companyId, 'abc')).toEqual({ valid: false, error: 'Account Code must be exactly 10 digits.' });
    });

    it('requires the parent account to exist at every level', async () => {
      await expectBusinessError(accounts.create(companyId, posting('0109010001', 'Orphan', 'Asset', 'Debit')), 'Parent Account 0109010000 does not exist.');
      await expectBusinessError(accounts.create(companyId, header('0109010000', 'Orphan Group', 'Asset', 'Debit')), 'Parent Account 0109000000 does not exist.');
      await expectBusinessError(accounts.create(companyId, header('0302000000', 'Orphan Equity', 'Equity', 'Credit')), 'Parent Account 0300000000 does not exist.');
      expect(await prisma.account.count({ where: { companyId, code: { in: ['0109010001', '0109010000', '0302000000'] } } })).toBe(0);
    });

    it('requires header (non-posting) account codes to end with 0000', async () => {
      await expectBusinessError(accounts.create(companyId, header('0101010007', 'Header With Posting Code', 'Asset', 'Debit')), 'Header Account Code must end with 0000.');
    });

    it('rejects a duplicate code in the same company', async () => {
      await expectBusinessError(accounts.create(companyId, posting('0101010001', 'Cash Again', 'Asset', 'Debit')), 'Account Code 0101010001 already exists.');
      expect(await accounts.validateCode(companyId, '0101010001')).toEqual({ valid: false, error: 'This Account Code already exists.' });
      expect(await accounts.validateCode(companyId, '0101010099')).toEqual({ valid: true });
      expect(await prisma.account.count({ where: { companyId, code: '0101010001' } })).toBe(1);
    });

    it('generates the next free code for each level', async () => {
      // Level 1 -> next group, Level 2 -> next sub group, Level 3 -> next posting number.
      expect(await accounts.nextCode(companyId, '0100000000', false)).toEqual({ code: '0102000000' });
      expect(await accounts.nextCode(companyId, '0101000000', false)).toEqual({ code: '0101020000' });
      expect(await accounts.nextCode(companyId, '0101010000', true)).toEqual({ code: '0101010002' });
      expect(await accounts.nextCode(companyId, '0202010000', true)).toEqual({ code: '0202010001' });
      // A posting account cannot be created directly under a Main Category, and a Sub Group cannot have header children.
      expect(await accounts.nextCode(companyId, '0100000000', true)).toEqual({ code: null });
      expect(await accounts.nextCode(companyId, '0101010000', false)).toEqual({ code: null });
    });

    it('fills gaps when generating the next posting code', async () => {
      await accounts.create(companyId, posting('0101010003', 'Petty Cash', 'Asset', 'Debit'));
      expect(await accounts.nextCode(companyId, '0101010000', true)).toEqual({ code: '0101010002' });
      await accounts.create(companyId, posting('0101010002', 'Bank Current Account', 'Asset', 'Debit'));
      expect(await accounts.nextCode(companyId, '0101010000', true)).toEqual({ code: '0101010004' });
    });

    it('lists, searches and builds the hierarchy only for this company', async () => {
      const page = await accounts.list(companyId, schemas.accountListQuerySchema.parse({ search: 'cash', limit: 2 }));
      expect(page.data.every(row => row.company_id === companyId)).toBe(true);
      expect(page.pagination.total).toBeGreaterThanOrEqual(3);
      expect(page.data).toHaveLength(2);
      expect(page.data.map(row => row.code)).toEqual([...page.data.map(row => row.code)].sort());

      const postingOnly = await accounts.list(companyId, schemas.accountListQuerySchema.parse({ is_posting: 'true', limit: 200 }));
      expect(postingOnly.data.every(row => row.is_posting)).toBe(true);

      const tree = await accounts.hierarchy(companyId);
      const assets = tree.find(node => node.code === '0100000000');
      const cashGroup = assets?.children.find(node => node.code === '0101000000')?.children.find(node => node.code === '0101010000');
      expect(cashGroup?.children.map(node => node.code)).toEqual(['0101010001', '0101010002', '0101010003']);

      const children = await accounts.children(companyId, '0101010000');
      expect(children.map(child => child.code)).toEqual(['0101010001', '0101010002', '0101010003']);
      expect((await accounts.topLevel(companyId)).map(row => row.code)).toEqual(['0100000000', '0200000000']);
    });

    // BUG: accountListQuerySchema (src/modules/accounts/account.schema.ts) uses z.coerce.boolean() for is_active and
    // is_posting. Query strings are text and Boolean('false') is true, so GET /accounts?is_active=false or
    // ?is_posting=false returns active / posting accounts instead of inactive / header accounts.
    it('reads is_active=false and is_posting=false from the query string as false', () => {
      const parsed = schemas.accountListQuerySchema.parse({ is_active: 'false', is_posting: 'false' });
      expect(parsed.is_active).toBe(false);
      expect(parsed.is_posting).toBe(false);
    });

    it('returns 404 for an account id that is not in the company', async () => {
      await expectBusinessError(accounts.getById(companyId, '00000000-0000-4000-8000-000000000000'), 'Account was not found.', 404);
      await expectBusinessError(accounts.update(companyId, '00000000-0000-4000-8000-000000000000', { name: 'X' }), 'Account was not found.', 404);
    });
  });

  describe('update, history and activation', () => {
    it('saves name and description changes with from/to history', async () => {
      const cash = await byCode('0101010001');
      const updated = await accounts.update(companyId, cash.id, { name: 'Cash In Hand - Head Office', description: 'Counter cash' });
      expect(updated.name).toBe('Cash In Hand - Head Office');
      expect(updated.description).toBe('Counter cash');

      const history = await accounts.history(companyId, cash.id);
      expect(history[0].action).toBe('updated');
      expect(history[0].changes).toEqual({
        name: { from: 'Cash In Hand', to: 'Cash In Hand - Head Office' },
        description: { from: 'Main till', to: 'Counter cash' },
      });
      expect(history.map(entry => entry.action)).toContain('created');
    });

    it('does not write history when nothing changes', async () => {
      const cash = await byCode('0101010001');
      const before = await prisma.accountAuditLog.count({ where: { companyId, accountId: cash.id } });
      await accounts.update(companyId, cash.id, { name: 'Cash In Hand - Head Office', description: '  Counter cash ' });
      expect(await prisma.accountAuditLog.count({ where: { companyId, accountId: cash.id } })).toBe(before);
    });

    it('does not allow a system account to be deactivated', async () => {
      const created = await accounts.create(companyId, { ...posting('0101010010', 'System Clearing', 'Asset', 'Debit'), is_system: true });
      await expectBusinessError(accounts.setActive(companyId, created.account.id, false), 'System accounts cannot be deactivated.');
      expect((await byCode('0101010010')).isActive).toBe(true);
    });

    it('does not allow an account with active children to be deactivated, but allows it once children are inactive', async () => {
      await accounts.create(companyId, header('0202020000', 'Accrued Liabilities', 'Liability', 'Credit'));
      const child = await accounts.create(companyId, posting('0202020001', 'Accrued Salaries', 'Liability', 'Credit'));
      const parent = await byCode('0202020000');

      await expectBusinessError(accounts.setActive(companyId, parent.id, false), 'Cannot deactivate account with 1 active child account(s).');
      expect((await byCode('0202020000')).isActive).toBe(true);

      const deactivatedChild = await accounts.setActive(companyId, child.account.id, false);
      expect(deactivatedChild.is_active).toBe(false);
      const deactivatedParent = await accounts.setActive(companyId, parent.id, false);
      expect(deactivatedParent.is_active).toBe(false);

      const history = await accounts.history(companyId, parent.id);
      expect(history[0]).toMatchObject({ action: 'deactivated', changes: { is_active: { from: true, to: false } } });

      // Reactivate so later tests can use the group.
      expect((await accounts.setActive(companyId, parent.id, true)).is_active).toBe(true);
      expect((await accounts.history(companyId, parent.id))[0].action).toBe('activated');
    });

    it('bulk toggles only accounts that may change and reports the count', async () => {
      const a = await accounts.create(companyId, posting('0202010001', 'Trade Payable A', 'Liability', 'Credit'));
      const b = await accounts.create(companyId, posting('0202010002', 'Trade Payable B', 'Liability', 'Credit'));
      const system = await byCode('0101010010');
      const parentWithChildren = await byCode('0202010000');

      // The parent is listed first: at that moment it still has active children, so it is skipped.
      const result = await accounts.bulkSetActive(companyId, [parentWithChildren.id, system.id, a.account.id, b.account.id], false);
      expect(result).toEqual({ success: true, updated: 2, message: '2 account(s) deactivated.' });

      const rows = await prisma.account.findMany({ where: { companyId, id: { in: [a.account.id, b.account.id, system.id, parentWithChildren.id] } } });
      const activeById = new Map(rows.map(row => [row.id, row.isActive]));
      expect(activeById.get(a.account.id)).toBe(false);
      expect(activeById.get(b.account.id)).toBe(false);
      expect(activeById.get(system.id)).toBe(true);
      expect(activeById.get(parentWithChildren.id)).toBe(true);

      // Running it again changes nothing; activating brings both back.
      expect((await accounts.bulkSetActive(companyId, [a.account.id, b.account.id], false)).updated).toBe(0);
      expect((await accounts.bulkSetActive(companyId, [a.account.id, b.account.id], true)).updated).toBe(2);
    });

    it('rejects bulk requests that are empty or not uuids at the schema level', () => {
      expect(schemas.bulkSetAccountActiveSchema.safeParse({ ids: [], is_active: true }).success).toBe(false);
      expect(schemas.bulkSetAccountActiveSchema.safeParse({ ids: ['not-a-uuid'], is_active: true }).success).toBe(false);
    });
  });

  describe('opening balances', () => {
    let lockedPeriodName = '';

    beforeAll(async () => {
      const fiscalYears = new FiscalYearService(companyId);
      const created = await fiscalYears.create({
        fiscal_year: '2025', year_basis: 'calendar', start_date: '2025-01-01', end_date: '2025-12-31',
        number_of_periods: 12, posting_cutoff_days: 0,
      });
      const march = created.periods.find(period => period.period_number === 3)!;
      lockedPeriodName = march.period_name;
      await fiscalYears.lockPeriod(march.id);
    });

    it('requires an Opening Balance Date when an amount is entered', async () => {
      await expectBusinessError(
        accounts.create(companyId, posting('0101010020', 'No Date Bank', 'Asset', 'Debit', { opening_balance: 250 })),
        'Opening Balance Date is required when an Opening Balance is entered.',
      );
      expect(await prisma.account.count({ where: { companyId, code: '0101010020' } })).toBe(0);

      const plain = await accounts.create(companyId, posting('0101010021', 'Later Bank', 'Asset', 'Debit'));
      await expectBusinessError(
        accounts.update(companyId, plain.account.id, { opening_balance: 300 }),
        'Opening Balance Date is required when an Opening Balance is entered.',
      );
      expect((await byCode('0101010021')).openingBalance).toBeNull();
    });

    it('blocks an opening balance dated on or before the end of a locked period', async () => {
      const message = `Opening Balance cannot be changed because period "${lockedPeriodName}" of Fiscal Year 2025 is already locked or closed. Post a Journal Voucher in an open period instead.`;
      await expectBusinessError(
        accounts.create(companyId, posting('0101010022', 'Locked Bank', 'Asset', 'Debit', { opening_balance: 100, opening_balance_date: '2025-02-01' })),
        message,
      );
      await expectBusinessError(
        accounts.create(companyId, posting('0101010022', 'Locked Bank', 'Asset', 'Debit', { opening_balance: 100, opening_balance_date: '2025-03-31' })),
        message,
      );
      expect(await prisma.account.count({ where: { companyId, code: '0101010022' } })).toBe(0);
    });

    it('allows an opening balance dated after the locked period and blocks moving it back', async () => {
      const created = await accounts.create(companyId, posting('0101010023', 'Open Bank', 'Asset', 'Debit', { opening_balance: 100, opening_balance_date: '2025-04-01' }));
      expect(created.account.opening_balance).toBe('100');

      await expectBusinessError(accounts.update(companyId, created.account.id, { opening_balance_date: '2025-01-15' }), /^Opening Balance cannot be changed because period/);
      // Changing the amount while the date stays after the locked period is allowed.
      const updated = await accounts.update(companyId, created.account.id, { opening_balance: 150 });
      expect(updated.opening_balance).toBe('150');
      const history = await accounts.history(companyId, created.account.id);
      expect(history[0].changes).toEqual({ opening_balance: { from: 100, to: 150 } });
    });

    it('summarises opening balances on each side and reports whether they balance', async () => {
      // Start from whatever earlier tests left (0101010023 = 150 Debit), then add known amounts.
      const before = await accounts.openingBalanceSummary(companyId);
      expect(before).toMatchObject({ account_count: 1, total_debit: '150.00', total_credit: '0.00', is_balanced: false });

      await accounts.create(companyId, posting('0202010010', 'Opening Payable', 'Liability', 'Credit', { opening_balance: 400, opening_balance_date: '2025-06-01' }));
      let summary = await accounts.openingBalanceSummary(companyId);
      expect(summary).toEqual({
        account_count: 2,
        total_debit: '150.00',
        total_credit: '400.00',
        difference: '250.00',
        is_balanced: false,
        accounts_without_date: 0,
      });

      await accounts.create(companyId, posting('0101010024', 'Opening Stock Cash', 'Asset', 'Debit', { opening_balance: 250, opening_balance_date: '2025-06-01' }));
      summary = await accounts.openingBalanceSummary(companyId);
      expect(summary).toMatchObject({ account_count: 3, total_debit: '400.00', total_credit: '400.00', difference: '0.00', is_balanced: true });

      // Old data can have an amount without a date; it is counted so the user can fix it.
      const legacy = await accounts.create(companyId, posting('0202010011', 'Legacy Payable', 'Liability', 'Credit'));
      await prisma.account.update({ where: { id: legacy.account.id }, data: { openingBalance: 10 } });
      summary = await accounts.openingBalanceSummary(companyId);
      expect(summary).toMatchObject({ account_count: 4, total_credit: '410.00', is_balanced: false, accounts_without_date: 1 });
      await prisma.account.update({ where: { id: legacy.account.id }, data: { openingBalance: null } });
    });

    it('shows the current balance on the normal side for Debit and Credit accounts', async () => {
      const debitAccount = await byCode('0101010024'); // Debit, opening 250
      const creditAccount = await byCode('0202010010'); // Credit, opening 400

      await prisma.$transaction(async transaction => {
        await insertPostedVoucher(transaction, {
          companyId,
          voucherNumber: 'JV-ACCOUNTS-TEST-0001',
          voucherType: 'JV',
          voucherDate: '2025-07-15',
          reference: null,
          narration: 'Account balance test',
          userId: null,
          lines: [
            { account: { id: debitAccount.id, code: debitAccount.code, name: debitAccount.name }, debit: new Decimal(100), credit: new Decimal(0), narration: 'Dr' },
            { account: { id: creditAccount.id, code: creditAccount.code, name: creditAccount.name }, debit: new Decimal(0), credit: new Decimal(100), narration: 'Cr' },
          ],
        });
        // A Draft voucher must not change the current balance.
        await transaction.$executeRaw`
          INSERT INTO vouchers (company_id, voucher_number, voucher_type, voucher_date, narration, status, total_debit, total_credit, updated_at)
          VALUES (CAST(${companyId} AS uuid), 'JV-ACCOUNTS-TEST-DRAFT', 'JV', DATE '2025-07-16', 'Draft', 'Draft', 999, 999, now())
        `;
        await transaction.$executeRaw`
          INSERT INTO voucher_lines (voucher_id, company_id, account_id, account_code, account_name, dr_amount, cr_amount, narration, line_no)
          SELECT id, company_id, CAST(${debitAccount.id} AS uuid), ${debitAccount.code}, ${debitAccount.name}, 999, 0, 'Draft', 1
          FROM vouchers WHERE company_id = CAST(${companyId} AS uuid) AND voucher_number = 'JV-ACCOUNTS-TEST-DRAFT'
        `;
      });

      const listed = await accounts.list(companyId, schemas.accountListQuerySchema.parse({ search: 'Opening', limit: 200 }));
      const balanceOf = (code: string) => Number(listed.data.find(row => row.code === code)?.current_balance);
      expect(balanceOf('0101010024')).toBe(350); // 250 opening + 100 debit
      expect(balanceOf('0202010010')).toBe(500); // 400 opening + 100 credit, shown as positive
    });
  });

  describe('clone', () => {
    it('clones into the next free code under the same parent with the same type and a "cloned" audit log', async () => {
      const source = await byCode('0101010010'); // system account
      const result = await accounts.clone(companyId, source.id, 'System Clearing Copy');

      // 0001-0003, 0010, 0021, 0023 and 0024 are taken, so the first free code is 0004.
      expect(result.account.code).toBe('0101010004');
      expect(result.account).toMatchObject({
        name: 'System Clearing Copy',
        account_type: 'Asset',
        normal_balance: 'Debit',
        is_posting: true,
        is_system: false,
        is_active: true,
      });
      expect(result.message).toBe(`Cloned as ${result.account.code}.`);

      const history = await accounts.history(companyId, result.account.id);
      expect(history[0]).toMatchObject({ action: 'cloned', changes: { cloned_from: { from: null, to: '0101010010' } } });
    });

    it('clones a header account into the next free header code', async () => {
      const source = await byCode('0202020000');
      const result = await accounts.clone(companyId, source.id, 'Accrued Liabilities Copy');
      expect(result.account.code).toBe('0202030000');
      expect(result.account.is_posting).toBe(false);
    });

    it('does not clone a Main Category account', async () => {
      const assets = await byCode('0100000000');
      await expectBusinessError(accounts.clone(companyId, assets.id, 'Assets Copy'), 'Main Category accounts cannot be cloned.');
    });

    // BUG: AccountListService.clone copies openingBalance/openingBalanceDate from the source account
    // (src/modules/accounts/account-list.service.ts, clone(): `openingBalance: source.openingBalance`). The new
    // account then carries a second copy of the same opening balance, which inflates the opening Trial Balance,
    // and it is saved without the locked-period check that create/update apply. A clone should start at zero.
    it('starts a cloned account without the source opening balance', async () => {
      const source = await byCode('0101010024'); // has an opening balance of 250
      const result = await accounts.clone(companyId, source.id, 'Opening Stock Cash Copy');
      expect(Number(result.account.opening_balance ?? 0)).toBe(0);
    });
  });
});
