/**
 * Settings tests against the real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env):
 * general settings, company profile and posting account settings. Everything happens inside a new test
 * company that is deleted afterwards, so other companies are never touched.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, insertAccount, type TestCompany } from './support/test-database.js';

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

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const DEFAULT_ACCOUNT_CODES = [
  '0101100101', // Cash In Hand
  '0101300301', // Inventory Finished Goods
  '0101400301', // VAT Recoverable
  '0201300101', // Sales Tax Payable
  '0302100101', // Retained Earnings
  '0401100101', // Sales Revenue
  '0401200101', // Freight Income
  '0401300101', // Stock Adjustment Gain
  '0501100101', // Cost Of Goods Sold
  '0502100401', // Freight And Delivery
  '0502100501', // Purchase Discount Received
  '0502200101', // Sales Discount Allowed
  '0502300101', // Stock Adjustment Loss
];

describe.skipIf(!databaseUrl)('Settings (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let generalSettings: InstanceType<typeof import('../src/modules/settings/general-settings.service.js')['GeneralSettingsService']>;
  let companyProfile: InstanceType<typeof import('../src/modules/settings/company-profile.service.js')['CompanyProfileService']>;
  let postingSettings: InstanceType<typeof import('../src/modules/settings/posting-account-settings.service.js')['PostingAccountSettingsService']>;
  let accountList: InstanceType<typeof import('../src/modules/accounts/account-list.service.js')['AccountListService']>;

  type Snapshot = Awaited<ReturnType<typeof postingSettings.get>>;
  const row = (section: unknown) => section as Record<string, unknown>;

  beforeAll(async () => {
    company = await createTestCompany('Settings');
    prisma = company.prisma;
    companyId = company.companyId;
    generalSettings = new (await import('../src/modules/settings/general-settings.service.js')).GeneralSettingsService();
    companyProfile = new (await import('../src/modules/settings/company-profile.service.js')).CompanyProfileService();
    postingSettings = new (await import('../src/modules/settings/posting-account-settings.service.js')).PostingAccountSettingsService(companyId);
    accountList = new (await import('../src/modules/accounts/account-list.service.js')).AccountListService();
  }, 120000);

  afterAll(async () => {
    if (company) await company.cleanup();
    await prisma?.$disconnect();
  });

  describe('general settings', () => {
    it('returns the built-in defaults (without saving) when the company has no settings yet', async () => {
      const settings = await generalSettings.getForCompany(companyId);
      expect(settings).toEqual({
        id: null,
        company_id: companyId,
        default_country_code: 'PK',
        time_zone: 'Asia/Karachi',
        locale: 'en-PK',
        date_format: 'dd/MM/yyyy',
        time_format: '12-hour',
        currency_code: 'PKR',
        currency_symbol: 'Rs',
        currency_position: 'prefix',
        decimal_places: 2,
        thousand_separator: ',',
        decimal_separator: '.',
        is_active: true,
      });
      const saved = await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM general_settings WHERE company_id = CAST(${companyId} AS uuid)`;
      expect(saved[0].count).toBe(0);
    });

    it('saves a partial update on top of the defaults', async () => {
      const saved = await generalSettings.updateForCompany(companyId, { currency_code: 'USD', currency_symbol: '$', decimal_places: 3 });
      expect(saved.id).toEqual(expect.any(String));
      expect(saved).toMatchObject({ company_id: companyId, currency_code: 'USD', currency_symbol: '$', decimal_places: 3, date_format: 'dd/MM/yyyy', time_zone: 'Asia/Karachi' });
      expect(await generalSettings.getForCompany(companyId)).toEqual(saved);
    });

    it('keeps earlier values on the next update and treats null as "no change"', async () => {
      const first = await generalSettings.getForCompany(companyId);
      const saved = await generalSettings.updateForCompany(companyId, {
        date_format: 'yyyy-MM-dd', time_format: '24-hour', currency_symbol: null, thousand_separator: ' ', currency_position: 'suffix',
      });
      expect(saved).toMatchObject({
        id: first.id, currency_code: 'USD', currency_symbol: '$', decimal_places: 3,
        date_format: 'yyyy-MM-dd', time_format: '24-hour', thousand_separator: ' ', currency_position: 'suffix',
      });
      const count = await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM general_settings WHERE company_id = CAST(${companyId} AS uuid)`;
      expect(count[0].count).toBe(1);
    });
  });

  describe('company profile', () => {
    it('reads the company and returns 404 for an unknown company', async () => {
      const profile = await companyProfile.getForCompany(companyId);
      expect(profile).toMatchObject({ id: companyId, group_id: company.groupId });
      expect(profile.name).toMatch(/^Automated Test - Settings - /);
      await expectBusinessError(companyProfile.getForCompany(MISSING_ID), 'Company was not found.', 404);
    });

    it('updates only the fields that are sent and can clear a field with null', async () => {
      const before = await companyProfile.getForCompany(companyId);
      const updated = await companyProfile.updateForCompany(companyId, {
        name: `${before.name} Renamed`, tax_id: 'NTN-1234567', city: 'Karachi', phone: '021-1234567',
        fiscal_year_basis: 'july', number_of_periods: 12,
      });
      expect(updated).toMatchObject({
        name: `${before.name} Renamed`, tax_id: 'NTN-1234567', city: 'Karachi', phone: '021-1234567',
        fiscal_year_basis: 'july', number_of_periods: 12, description: before.description, country: before.country,
      });

      const cleared = await companyProfile.updateForCompany(companyId, { phone: null });
      expect(cleared).toMatchObject({ phone: null, city: 'Karachi', tax_id: 'NTN-1234567', fiscal_year_basis: 'july' });
    });
  });

  describe('posting account settings', () => {
    let first: Snapshot;

    it('creates the default posting accounts and settings on the first read', async () => {
      expect(await prisma.account.count({ where: { companyId } })).toBe(0);
      first = await postingSettings.get();

      const accounts = await prisma.account.findMany({ where: { companyId }, orderBy: { code: 'asc' } });
      expect(accounts.map(account => account.code)).toEqual(DEFAULT_ACCOUNT_CODES);
      expect(accounts.every(account => account.isSystem && account.isPosting && account.isActive)).toBe(true);
      const byCode = new Map(accounts.map(account => [account.code, account]));
      expect(byCode.get('0302100101')).toMatchObject({ accountType: 'Equity', normalBalance: 'Credit' });
      expect(byCode.get('0401100101')).toMatchObject({ accountType: 'Revenue', normalBalance: 'Credit' });
      expect(byCode.get('0501100101')).toMatchObject({ accountType: 'Expense', normalBalance: 'Debit' });

      expect(row(first.purchase)).toMatchObject({
        default_cash_account_code: '0101100101', default_inventory_account_code: '0101300301', purchase_tax_account_code: '0101400301',
        freight_account_code: '0502100401', purchase_discount_account_code: '0502100501',
      });
      expect(row(first.sale)).toMatchObject({
        default_cash_account_code: '0101100101', default_inventory_account_code: '0101300301', sales_revenue_account_code: '0401100101',
        sales_tax_account_code: '0201300101', sales_discount_account_code: '0502200101', freight_income_account_code: '0401200101',
        cost_of_goods_sold_account_code: '0501100101',
      });
      expect(row(first.stock_adjustment)).toMatchObject({
        default_inventory_account_code: '0101300301', adjustment_gain_account_code: '0401300101', adjustment_loss_account_code: '0502300101',
      });
      expect(row(first.year_end)).toMatchObject({ retained_earnings_account_code: '0302100101', retained_earnings_account_id: byCode.get('0302100101')!.id });
    });

    it('does not create anything again on later reads', async () => {
      const second = await postingSettings.get();
      expect(await prisma.account.count({ where: { companyId } })).toBe(DEFAULT_ACCOUNT_CODES.length);
      expect(row(second.purchase).id).toBe(row(first.purchase).id);
      expect(row(second.sale).default_cash_account_id).toBe(row(first.sale).default_cash_account_id);
      expect(row(second.year_end).retained_earnings_account_id).toBe(row(first.year_end).retained_earnings_account_id);
    });

    it('does not overwrite a renamed default account on later reads', async () => {
      const cash = await prisma.account.findFirstOrThrow({ where: { companyId, code: '0101100101' } });
      await accountList.update(companyId, cash.id, { name: 'Main Cash Counter' });
      await postingSettings.get();
      expect((await prisma.account.findUniqueOrThrow({ where: { id: cash.id } })).name).toBe('Main Cash Counter');
    });

    it('requires Retained Earnings to be an Equity posting account under 0302', async () => {
      const revenue = await prisma.account.findFirstOrThrow({ where: { companyId, code: '0401100101' } });
      await expectBusinessError(
        postingSettings.update({ year_end: { retained_earnings_account_id: revenue.id } }),
        'Retained Earnings Account must be an Equity account. The selected Account is Revenue.',
      );

      const capital = await insertAccount(prisma, companyId, '0301100101', 'Owner Capital', 'Equity', 'Credit');
      await expectBusinessError(
        postingSettings.update({ year_end: { retained_earnings_account_id: capital } }),
        'Retained Earnings Account must use an Account Code starting with 0302. The selected Account Code is 0301100101.',
      );

      const newRetained = await insertAccount(prisma, companyId, '0302100102', 'Retained Earnings - Current', 'Equity', 'Credit');
      const saved = await postingSettings.update({ year_end: { retained_earnings_account_id: newRetained } });
      expect(row(saved.year_end)).toMatchObject({ retained_earnings_account_id: newRetained, retained_earnings_account_code: '0302100102' });

      // A later read keeps the chosen account instead of going back to the default.
      expect(row((await postingSettings.get()).year_end).retained_earnings_account_id).toBe(newRetained);
    });

    it('requires Sales Revenue to be a Revenue account under 040110', async () => {
      const cogs = await prisma.account.findFirstOrThrow({ where: { companyId, code: '0501100101' } });
      await expectBusinessError(
        postingSettings.update({ sale: { sales_revenue_account_id: cogs.id } }),
        'Sales Revenue Account must be an Revenue account. The selected Account is Expense.',
      );
      const freightIncome = await prisma.account.findFirstOrThrow({ where: { companyId, code: '0401200101' } });
      await expectBusinessError(
        postingSettings.update({ sale: { sales_revenue_account_id: freightIncome.id } }),
        'Sales Revenue Account must use an Account Code starting with 040110. The selected Account Code is 0401200101.',
      );

      const serviceRevenue = await insertAccount(prisma, companyId, '0401100102', 'Service Revenue', 'Revenue', 'Credit');
      const saved = await postingSettings.update({ sale: { sales_revenue_account_id: serviceRevenue } });
      expect(row(saved.sale)).toMatchObject({ sales_revenue_account_id: serviceRevenue, sales_revenue_account_code: '0401100102' });
      // Other sale accounts are unchanged.
      expect(row(saved.sale).cost_of_goods_sold_account_code).toBe('0501100101');
    });

    it('only accepts active posting accounts of this company', async () => {
      const closedCash = await insertAccount(prisma, companyId, '0101100102', 'Closed Cash', 'Asset', 'Debit');
      await prisma.account.update({ where: { id: closedCash }, data: { isActive: false } });
      await expectBusinessError(
        postingSettings.update({ purchase: { default_cash_account_id: closedCash } }),
        'Purchase Cash Account must be an active posting account.',
      );

      const header = await prisma.account.create({
        data: { companyId, code: '0101100000', name: 'Cash Header', accountType: 'Asset', normalBalance: 'Debit', isPosting: false, isActive: true },
      });
      await expectBusinessError(
        postingSettings.update({ purchase: { default_cash_account_id: header.id } }),
        'Purchase Cash Account must be an active posting account.',
      );
      await expectBusinessError(
        postingSettings.update({ stock_adjustment: { adjustment_loss_account_id: MISSING_ID } }),
        'Stock Adjustment Loss Account must be an active posting account.',
      );
    });

    it('checks the type and category of stock adjustment and purchase accounts', async () => {
      const gain = await prisma.account.findFirstOrThrow({ where: { companyId, code: '0401300101' } });
      await expectBusinessError(
        postingSettings.update({ stock_adjustment: { adjustment_loss_account_id: gain.id } }),
        'Stock Adjustment Loss Account must be an Expense account. The selected Account is Revenue.',
      );
      const salesDiscount = await prisma.account.findFirstOrThrow({ where: { companyId, code: '0502200101' } });
      await expectBusinessError(
        postingSettings.update({ purchase: { freight_account_id: salesDiscount.id } }),
        'Purchase Freight Account must use an Account Code starting with 050210. The selected Account Code is 0502200101.',
      );
    });

    it('clears an optional account with null and keeps required accounts', async () => {
      const saved = await postingSettings.update({ purchase: { purchase_tax_account_id: null }, sale: { freight_income_account_id: null } });
      expect(row(saved.purchase)).toMatchObject({ purchase_tax_account_id: null, purchase_tax_account_code: null, default_cash_account_code: '0101100101' });
      expect(row(saved.sale)).toMatchObject({ freight_income_account_id: null, freight_income_account_code: null });

      // Reading again does not put the defaults back.
      const again = await postingSettings.get();
      expect(row(again.purchase).purchase_tax_account_id).toBeNull();
      expect(row(again.sale).freight_income_account_id).toBeNull();
    });

    it('saves nothing when any section of the update is invalid', async () => {
      const before = await postingSettings.get();
      const otherCash = await insertAccount(prisma, companyId, '0101100103', 'Second Cash', 'Asset', 'Debit');
      const revenue = await prisma.account.findFirstOrThrow({ where: { companyId, code: '0401100101' } });

      await expectBusinessError(
        postingSettings.update({ sale: { default_cash_account_id: otherCash }, year_end: { retained_earnings_account_id: revenue.id } }),
        'Retained Earnings Account must be an Equity account. The selected Account is Revenue.',
      );
      const after = await postingSettings.get();
      expect(row(after.sale).default_cash_account_id).toBe(row(before.sale).default_cash_account_id);
    });
  });
});
