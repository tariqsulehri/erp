/**
 * Business report tests against a real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env):
 * Day Book, Aging, Sales Tax, Stock Ledger, Stock Valuation, Book Accounts and dashboard KPIs.
 * Data is produced by posting documents through the real post services inside a new test company,
 * which is deleted afterwards, so existing companies are untouched.
 */
import { randomUUID } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, insertAccount, type TestCompany } from './support/test-database.js';

type Scope = import('../src/modules/auth/access-rules.js').AccessScope;

describe.skipIf(!databaseUrl)('Business reports (database)', () => {
  let prisma: TestCompany['prisma'];
  let services: {
    PurchasePostService: typeof import('../src/modules/purchases/purchase-post.service.js')['PurchasePostService'];
    PurchaseReturnPostService: typeof import('../src/modules/purchase-returns/purchase-return-post.service.js')['PurchaseReturnPostService'];
    SalePostService: typeof import('../src/modules/sales/sale-post.service.js')['SalePostService'];
    SaleReturnPostService: typeof import('../src/modules/sale-returns/sale-return-post.service.js')['SaleReturnPostService'];
    VoucherService: typeof import('../src/modules/vouchers/voucher.service.js')['VoucherService'];
    FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
    PostingAccountSettingsService: typeof import('../src/modules/settings/posting-account-settings.service.js')['PostingAccountSettingsService'];
    DayBookReportService: typeof import('../src/modules/reports/day-book-report.service.js')['DayBookReportService'];
    AgingReportService: typeof import('../src/modules/reports/aging-report.service.js')['AgingReportService'];
    SalesTaxReportService: typeof import('../src/modules/reports/sales-tax-report.service.js')['SalesTaxReportService'];
    StockReportService: typeof import('../src/modules/reports/stock-report.service.js')['StockReportService'];
    BookAccountsService: typeof import('../src/modules/reports/book-accounts.service.js')['BookAccountsService'];
    DashboardKpiService: typeof import('../src/modules/dashboard/dashboard-kpi.service.js')['DashboardKpiService'];
  };

  let company: TestCompany;
  let companyId = '';
  let userId = '';
  let cashAccountId = '';
  let bankLedgerAccountId = '';
  let supplierId = '';
  let supplierAccountId = '';
  const customers: Record<'one' | 'two' | 'three', { id: string; accountId: string }> = {
    one: { id: '', accountId: '' }, two: { id: '', accountId: '' }, three: { id: '', accountId: '' },
  };
  let warehouseOneId = '';
  let warehouseTwoId = '';
  let itemId = '';
  let sequence = 0;
  const saleIds: Record<string, string> = {};
  let saleReturnId = '';

  const today = new Date().toISOString().slice(0, 10);
  const nextNumber = (prefix: string, year = 2025) => `${prefix}-${year}-${String(++sequence).padStart(4, '0')}`;

  const allScope = (): Scope => ({ companyId, userId, role: 'admin', accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null });

  beforeAll(async () => {
    company = await createTestCompany('Business Reports');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;
    services = {
      PurchasePostService: (await import('../src/modules/purchases/purchase-post.service.js')).PurchasePostService,
      PurchaseReturnPostService: (await import('../src/modules/purchase-returns/purchase-return-post.service.js')).PurchaseReturnPostService,
      SalePostService: (await import('../src/modules/sales/sale-post.service.js')).SalePostService,
      SaleReturnPostService: (await import('../src/modules/sale-returns/sale-return-post.service.js')).SaleReturnPostService,
      VoucherService: (await import('../src/modules/vouchers/voucher.service.js')).VoucherService,
      FiscalYearService: (await import('../src/modules/fiscal-years/fiscal-year.service.js')).FiscalYearService,
      PostingAccountSettingsService: (await import('../src/modules/settings/posting-account-settings.service.js')).PostingAccountSettingsService,
      DayBookReportService: (await import('../src/modules/reports/day-book-report.service.js')).DayBookReportService,
      AgingReportService: (await import('../src/modules/reports/aging-report.service.js')).AgingReportService,
      SalesTaxReportService: (await import('../src/modules/reports/sales-tax-report.service.js')).SalesTaxReportService,
      StockReportService: (await import('../src/modules/reports/stock-report.service.js')).StockReportService,
      BookAccountsService: (await import('../src/modules/reports/book-accounts.service.js')).BookAccountsService,
      DashboardKpiService: (await import('../src/modules/dashboard/dashboard-kpi.service.js')).DashboardKpiService,
    };

    // Fiscal years: 2025-2026 for the report data, plus the July year that contains today for the dashboard.
    const fiscalYears = new services.FiscalYearService(companyId);
    await fiscalYears.create({
      fiscal_year: '2025-2026', year_basis: 'july', start_date: '2025-07-01', end_date: '2026-06-30',
      number_of_periods: 12, posting_cutoff_days: 0,
    });
    const todayYear = Number(today.slice(0, 4));
    const startYear = Number(today.slice(5, 7)) >= 7 ? todayYear : todayYear - 1;
    if (startYear > 2025) {
      await fiscalYears.create({
        fiscal_year: `${startYear}-${startYear + 1}`, year_basis: 'july', start_date: `${startYear}-07-01`, end_date: `${startYear + 1}-06-30`,
        number_of_periods: 12, posting_cutoff_days: 0,
      });
    }

    const settings = await new services.PostingAccountSettingsService(companyId).get();
    cashAccountId = String(settings.purchase?.default_cash_account_id);
    const cash = await prisma.account.findUniqueOrThrow({ where: { id: cashAccountId } });

    // A bank ledger account in the same sub-group as cash: it must be a Bank account only, never Cash.
    bankLedgerAccountId = await insertAccount(prisma, companyId, `${cash.code.slice(0, 6)}9001`, 'Test Bank Ledger', 'Asset', 'Debit');
    await prisma.$executeRaw`
      INSERT INTO bank_accounts (company_id, ledger_account_id, code, bank_name, account_title, account_number)
      VALUES (CAST(${companyId} AS uuid), CAST(${bankLedgerAccountId} AS uuid), 'BANK-1', 'Test National Bank', 'Main Current', '0001112223')
    `;

    supplierAccountId = await insertAccount(prisma, companyId, '0201010001', 'Supplier Payable - Supplier One', 'Liability', 'Credit');
    supplierId = (await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO suppliers (company_id, code, name, ap_account_id, tax_registration_no)
      VALUES (CAST(${companyId} AS uuid), 'SUP-1', 'Supplier One', CAST(${supplierAccountId} AS uuid), 'STN-SUP-1') RETURNING id
    `)[0].id;

    const customerSeeds = [
      ['one', 'CUS-1', 'Customer One', '0103010001', 'NTN-CUS-1'],
      ['two', 'CUS-2', 'Customer Two', '0103010002', null],
      ['three', 'CUS-3', 'Customer Three', '0103010003', null],
    ] as const;
    for (const [key, code, name, accountCode, ntn] of customerSeeds) {
      const accountId = await insertAccount(prisma, companyId, accountCode, `Customer Receivable - ${name}`, 'Asset', 'Debit');
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO customers (company_id, code, name, ar_account_id, tax_registration_no)
        VALUES (CAST(${companyId} AS uuid), ${code}, ${name}, CAST(${accountId} AS uuid), ${ntn}) RETURNING id
      `;
      customers[key] = { id: rows[0].id, accountId };
    }
    // Customer Three owes an opening balance only.
    await prisma.$executeRaw`
      UPDATE accounts SET opening_balance = 150, opening_balance_date = '2025-07-01'
      WHERE id = CAST(${customers.three.accountId} AS uuid)
    `;

    warehouseOneId = (await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO inventory_warehouses (company_id, code, name) VALUES (CAST(${companyId} AS uuid), 'WH-1', 'Main Warehouse') RETURNING id
    `)[0].id;
    warehouseTwoId = (await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO inventory_warehouses (company_id, code, name) VALUES (CAST(${companyId} AS uuid), 'WH-2', 'Second Warehouse') RETURNING id
    `)[0].id;
    itemId = (await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO inventory_items (company_id, item_code, item_name) VALUES (CAST(${companyId} AS uuid), 'ITEM-1', 'Test Item') RETURNING id
    `)[0].id;

    // ---- Documents of 2025 (posted through the real services) ----
    const purchases = new services.PurchasePostService(companyId);
    const sales = new services.SalePostService(companyId);
    await purchases.post(await insertPurchaseDraft('2025-08-01', warehouseOneId, 10, 100, 170), userId);
    saleIds.one = await insertSaleDraft('2025-08-10', customers.one, 'Credit', 4, 200, 136);
    await sales.post(saleIds.one, userId);
    saleReturnId = await insertSaleReturnDraft('2025-08-15', customers.one, 1, 200, 34);
    await new services.SaleReturnPostService(companyId).post(saleReturnId, userId);
    await new services.PurchaseReturnPostService(companyId).post(await insertPurchaseReturnDraft('2025-08-20', 2, 100, 34), userId);
    await purchases.post(await insertPurchaseDraft('2025-09-01', warehouseTwoId, 3, 120, 0), userId);
    saleIds.two = await insertSaleDraft('2025-10-20', customers.one, 'Credit', 2, 100, 0);
    await sales.post(saleIds.two, userId);

    // A draft sale with tax inside the range must not appear anywhere.
    await insertSaleDraft('2025-08-25', customers.one, 'Credit', 1, 500, 85);

    await postJournal('2025-11-01', cashAccountId, customers.one.accountId, 300);
    await postJournal('2025-11-01', cashAccountId, customers.two.accountId, 500);
    await postJournal('2025-11-15', supplierAccountId, cashAccountId, 900);

    // An unposted (draft) journal must not appear in the Day Book.
    await journalDraft('2025-11-20', cashAccountId, customers.two.accountId, 77, false);
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  async function insertPurchaseDraft(date: string, warehouseId: string, quantity: number, price: number, tax: number) {
    const gross = new Decimal(quantity).times(price);
    const net = gross.plus(tax);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO purchase_invoices (
        company_id, purchase_number, purchase_date, supplier_id, supplier_account_id, payment_type, warehouse_id,
        gross_amount, discount_amount, tax_amount, freight_amount, net_amount, status
      )
      VALUES (
        CAST(${companyId} AS uuid), ${nextNumber('PI')}, CAST(${date} AS date), CAST(${supplierId} AS uuid), CAST(${supplierAccountId} AS uuid),
        'Credit', CAST(${warehouseId} AS uuid), ${gross.toFixed(2)}::numeric, 0, ${tax}::numeric, 0, ${net.toFixed(2)}::numeric, 'Draft'
      )
      RETURNING id
    `;
    await prisma.$executeRaw`
      INSERT INTO purchase_invoice_lines (
        company_id, purchase_invoice_id, line_number, item_id, item_code, item_name, warehouse_id,
        quantity, purchase_price, discount_amount, tax_amount, line_total
      )
      VALUES (
        CAST(${companyId} AS uuid), CAST(${rows[0].id} AS uuid), 1, CAST(${itemId} AS uuid), 'ITEM-1', 'Test Item', CAST(${warehouseId} AS uuid),
        ${quantity}::numeric, ${price}::numeric, 0, ${tax}::numeric, ${net.toFixed(2)}::numeric
      )
    `;
    return rows[0].id;
  }

  async function insertSaleDraft(
    date: string, customer: { id: string; accountId: string }, paymentType: 'Cash' | 'Credit',
    quantity: number, price: number, tax: number, year = 2025,
  ) {
    const gross = new Decimal(quantity).times(price);
    const net = gross.plus(tax);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO sale_invoices (
        company_id, sale_number, sale_date, customer_id, customer_account_id, payment_type, warehouse_id,
        gross_amount, discount_amount, tax_amount, freight_amount, net_amount, cost_amount, status
      )
      VALUES (
        CAST(${companyId} AS uuid), ${nextNumber('SI', year)}, CAST(${date} AS date), CAST(${customer.id} AS uuid), CAST(${customer.accountId} AS uuid),
        ${paymentType}, CAST(${warehouseOneId} AS uuid), ${gross.toFixed(2)}::numeric, 0, ${tax}::numeric, 0, ${net.toFixed(2)}::numeric, 0, 'Draft'
      )
      RETURNING id
    `;
    await prisma.$executeRaw`
      INSERT INTO sale_invoice_lines (
        company_id, sale_invoice_id, line_number, item_id, item_code, item_name, warehouse_id,
        quantity, sale_price, unit_cost, cost_amount, line_total
      )
      VALUES (
        CAST(${companyId} AS uuid), CAST(${rows[0].id} AS uuid), 1, CAST(${itemId} AS uuid), 'ITEM-1', 'Test Item', CAST(${warehouseOneId} AS uuid),
        ${quantity}::numeric, ${price}::numeric, 0, 0, ${gross.toFixed(2)}::numeric
      )
    `;
    return rows[0].id;
  }

  async function insertSaleReturnDraft(date: string, customer: { id: string; accountId: string }, quantity: number, price: number, tax: number) {
    const gross = new Decimal(quantity).times(price);
    const net = gross.plus(tax);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO sale_returns (
        company_id, sale_return_number, sale_return_date, customer_id, customer_account_id, payment_type, warehouse_id,
        gross_amount, discount_amount, tax_amount, freight_amount, net_amount, cost_amount, status
      )
      VALUES (
        CAST(${companyId} AS uuid), ${nextNumber('SR')}, CAST(${date} AS date), CAST(${customer.id} AS uuid), CAST(${customer.accountId} AS uuid),
        'Credit', CAST(${warehouseOneId} AS uuid), ${gross.toFixed(2)}::numeric, 0, ${tax}::numeric, 0, ${net.toFixed(2)}::numeric, 0, 'Draft'
      )
      RETURNING id
    `;
    await prisma.$executeRaw`
      INSERT INTO sale_return_lines (
        company_id, sale_return_id, line_number, item_id, item_code, item_name, warehouse_id,
        quantity, sale_price, unit_cost, cost_amount, line_total
      )
      VALUES (
        CAST(${companyId} AS uuid), CAST(${rows[0].id} AS uuid), 1, CAST(${itemId} AS uuid), 'ITEM-1', 'Test Item', CAST(${warehouseOneId} AS uuid),
        ${quantity}::numeric, ${price}::numeric, 0, 0, ${gross.toFixed(2)}::numeric
      )
    `;
    return rows[0].id;
  }

  async function insertPurchaseReturnDraft(date: string, quantity: number, price: number, tax: number) {
    const gross = new Decimal(quantity).times(price);
    const net = gross.plus(tax);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO purchase_returns (
        company_id, purchase_return_number, purchase_return_date, supplier_id, supplier_account_id, payment_type, warehouse_id,
        gross_amount, discount_amount, tax_amount, freight_amount, net_amount, status
      )
      VALUES (
        CAST(${companyId} AS uuid), ${nextNumber('PR')}, CAST(${date} AS date), CAST(${supplierId} AS uuid), CAST(${supplierAccountId} AS uuid),
        'Credit', CAST(${warehouseOneId} AS uuid), ${gross.toFixed(2)}::numeric, 0, ${tax}::numeric, 0, ${net.toFixed(2)}::numeric, 'Draft'
      )
      RETURNING id
    `;
    await prisma.$executeRaw`
      INSERT INTO purchase_return_lines (
        company_id, purchase_return_id, line_number, item_id, item_code, item_name, warehouse_id,
        quantity, purchase_price, discount_amount, tax_amount, line_total
      )
      VALUES (
        CAST(${companyId} AS uuid), CAST(${rows[0].id} AS uuid), 1, CAST(${itemId} AS uuid), 'ITEM-1', 'Test Item', CAST(${warehouseOneId} AS uuid),
        ${quantity}::numeric, ${price}::numeric, 0, ${tax}::numeric, ${net.toFixed(2)}::numeric
      )
    `;
    return rows[0].id;
  }

  async function journalDraft(date: string, debitAccountId: string, creditAccountId: string, amount: number, submit: boolean) {
    const accounts = await prisma.account.findMany({ where: { id: { in: [debitAccountId, creditAccountId] } } });
    const byId = new Map(accounts.map(account => [account.id, account]));
    return new services.VoucherService(companyId).create({
      voucher_type: 'JV', voucher_date: date, submit_for_approval: submit,
      lines: [
        { account_id: debitAccountId, account_code: byId.get(debitAccountId)!.code, account_name: byId.get(debitAccountId)!.name, dr_amount: amount, cr_amount: 0, line_no: 1 },
        { account_id: creditAccountId, account_code: byId.get(creditAccountId)!.code, account_name: byId.get(creditAccountId)!.name, dr_amount: 0, cr_amount: amount, line_no: 2 },
      ],
    }, userId);
  }

  async function postJournal(date: string, debitAccountId: string, creditAccountId: string, amount: number) {
    const vouchers = new services.VoucherService(companyId);
    const draft = await journalDraft(date, debitAccountId, creditAccountId, amount, true);
    await vouchers.approve(draft.id, {}, randomUUID());
    return vouchers.post(draft.id, userId);
  }

  async function costOf(table: 'sale_invoices' | 'sale_returns', id: string) {
    const rows = await prisma.$queryRawUnsafe<{ cost_amount: string }[]>(
      `SELECT cost_amount::text FROM ${table} WHERE id = CAST($1 AS uuid)`, id,
    );
    return new Decimal(rows[0].cost_amount);
  }

  async function snapshotStockValue() {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT COALESCE(SUM(total_stock_value), 0)::text AS value FROM inventory_stock_balances WHERE company_id = CAST(${companyId} AS uuid)
    `;
    return new Decimal(rows[0].value);
  }

  // ---------------- Day Book ----------------

  describe('Day Book', () => {
    const range = { date_from: '2025-07-01', date_to: '2025-12-31' };

    it('lists only posted vouchers and pages them in date and number order', async () => {
      const report = new services.DayBookReportService(companyId);
      const all = await report.getDayBook({ ...range, page: 1, limit: 200 });
      // 2 purchases, 2 sales, 1 sale return, 1 purchase return, 3 posted journals; the draft journal is left out.
      expect(all.totals.voucher_count).toBe(9);
      expect(all.vouchers).toHaveLength(9);
      const keys = all.vouchers.map(voucher => `${voucher.voucher_date}|${voucher.voucher_number}`);
      expect([...keys].sort()).toEqual(keys);
      expect(all.vouchers.every(voucher => voucher.lines.length >= 2)).toBe(true);

      const pageOne = await report.getDayBook({ ...range, page: 1, limit: 4 });
      const pageThree = await report.getDayBook({ ...range, page: 3, limit: 4 });
      expect(pageOne.vouchers).toHaveLength(4);
      expect(pageThree.vouchers).toHaveLength(1);
      expect(pageOne.pagination).toEqual({ total: 9, page: 1, limit: 4, pages: 3 });
      expect(pageThree.vouchers[0].id).toBe(all.vouchers[8].id);
    });

    it('gives totals for the whole range, not only the current page', async () => {
      const report = new services.DayBookReportService(companyId);
      const all = await report.getDayBook({ ...range, page: 1, limit: 200 });
      const sum = all.vouchers.reduce((total, voucher) => total.plus(voucher.total_debit), new Decimal(0));
      const pageTwo = await report.getDayBook({ ...range, page: 2, limit: 4 });
      expect(pageTwo.totals.total_debit).toBe(sum.toFixed(2));
      expect(pageTwo.totals.total_credit).toBe(pageTwo.totals.total_debit);
      expect(pageTwo.totals.voucher_count).toBe(9);
      // Each voucher balances line by line.
      for (const voucher of all.vouchers) {
        const debit = voucher.lines.reduce((total, line) => total.plus(line.debit_amount), new Decimal(0));
        const credit = voucher.lines.reduce((total, line) => total.plus(line.credit_amount), new Decimal(0));
        expect(debit.toFixed(2)).toBe(voucher.total_debit);
        expect(credit.toFixed(2)).toBe(voucher.total_credit);
      }
    });

    it('filters by voucher type and date range and rejects a reversed range', async () => {
      const report = new services.DayBookReportService(companyId);
      const journals = await report.getDayBook({ ...range, voucher_type: 'JV', page: 1, limit: 50 });
      expect(journals.totals.voucher_count).toBe(3);
      expect(journals.vouchers.every(voucher => voucher.voucher_type === 'JV')).toBe(true);

      const august = await report.getDayBook({ date_from: '2025-08-01', date_to: '2025-08-31', page: 1, limit: 50 });
      expect(august.vouchers.map(voucher => voucher.voucher_type).sort()).toEqual(['PI', 'PR', 'SI', 'SR']);

      const empty = await report.getDayBook({ date_from: '2024-01-01', date_to: '2024-01-31', page: 1, limit: 50 });
      expect(empty.totals).toEqual({ voucher_count: 0, total_debit: '0.00', total_credit: '0.00' });
      expect(empty.pagination.pages).toBe(1);

      await expect(report.getDayBook({ date_from: '2025-08-31', date_to: '2025-08-01', page: 1, limit: 50 }))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Date To cannot be before Date From/) });
    });
  });

  // ---------------- Aging ----------------

  describe('Aging', () => {
    it('ages receivables first-in, first-out and shows overpayment as Advance', async () => {
      const aging = await new services.AgingReportService(companyId).getAging({ kind: 'receivables', as_of_date: '2025-11-30' });
      const byId = new Map(aging.rows.map(row => [row.party_id, row]));

      // Customer One: 936 (Aug 10, 112 days) + 200 (Oct 20, 41 days) less 234 return and 300 receipt applied to the oldest first.
      expect(byId.get(customers.one.id)).toMatchObject({
        days_0_30: '0.00', days_31_60: '200.00', days_61_90: '0.00', over_90: '402.00', advance: '0.00', balance: '602.00',
      });
      // Customer Two paid 500 with nothing owed.
      expect(byId.get(customers.two.id)).toMatchObject({ over_90: '0.00', advance: '500.00', balance: '-500.00' });
      // Customer Three: opening balance dated 2025-07-01 is 152 days old.
      expect(byId.get(customers.three.id)).toMatchObject({ over_90: '150.00', balance: '150.00' });

      expect(aging.totals).toMatchObject({
        days_0_30: '0.00', days_31_60: '200.00', days_61_90: '0.00', over_90: '552.00', advance: '500.00', balance: '252.00',
      });
      expect(aging.buckets.map(bucket => bucket.key)).toEqual(['days_0_30', 'days_31_60', 'days_61_90', 'over_90']);
    });

    it('ignores movements after the As Of date and leaves out settled parties', async () => {
      const aging = await new services.AgingReportService(companyId).getAging({ kind: 'receivables', as_of_date: '2025-08-31' });
      const byId = new Map(aging.rows.map(row => [row.party_id, row]));
      expect(byId.get(customers.one.id)).toMatchObject({ days_0_30: '702.00', balance: '702.00' });
      // Customer Two has no movement yet, so has no row.
      expect(byId.has(customers.two.id)).toBe(false);
      // Customer Three's opening balance (Jul 1) is 61 days old.
      expect(byId.get(customers.three.id)).toMatchObject({ days_61_90: '150.00' });
    });

    it('ages payables on the credit side with a 90-day boundary', async () => {
      const aging = await new services.AgingReportService(companyId).getAging({ kind: 'payables', as_of_date: '2025-11-30' });
      expect(aging.rows).toHaveLength(1);
      // 1170 (Aug 1, 121 days) and 360 (Sep 1, exactly 90 days) less 234 return and 900 payment.
      expect(aging.rows[0]).toMatchObject({
        party_id: supplierId, days_0_30: '0.00', days_31_60: '0.00', days_61_90: '360.00', over_90: '36.00', advance: '0.00', balance: '396.00',
      });
    });
  });

  // ---------------- Sales Tax ----------------

  describe('Sales Tax', () => {
    it('nets output tax against input tax with returns shown as negative', async () => {
      const report = await new services.SalesTaxReportService(companyId).getSalesTax({ date_from: '2025-08-01', date_to: '2025-09-30' });
      expect(report.summary).toEqual({
        output_taxable_amount: '600.00',
        output_tax: '102.00',
        input_taxable_amount: '1160.00',
        input_tax: '136.00',
        net_tax_payable: '0.00',
        net_tax_refundable: '34.00',
      });
      // The draft sale of Aug 25 is not included.
      expect(report.documents.map(doc => doc.document_type)).toEqual(['Purchase', 'Sale', 'Sale Return', 'Purchase Return', 'Purchase']);

      const saleReturn = report.documents.find(doc => doc.document_type === 'Sale Return')!;
      expect(saleReturn).toMatchObject({ tax_side: 'Output', taxable_amount: '-200.00', tax_amount: '-34.00', tax_registration_no: 'NTN-CUS-1' });
      const purchaseReturn = report.documents.find(doc => doc.document_type === 'Purchase Return')!;
      expect(purchaseReturn).toMatchObject({ tax_side: 'Input', taxable_amount: '-200.00', tax_amount: '-34.00', tax_registration_no: 'STN-SUP-1' });
      const sale = report.documents.find(doc => doc.document_type === 'Sale')!;
      expect(sale).toMatchObject({ tax_side: 'Output', taxable_amount: '800.00', tax_amount: '136.00', party_name: 'Customer One' });
    });

    it('shows tax payable when output tax is higher', async () => {
      const report = await new services.SalesTaxReportService(companyId).getSalesTax({ date_from: '2025-08-02', date_to: '2025-08-31' });
      // Purchase of Aug 1 is outside; output 102 less input refund -34 → 136 payable.
      expect(report.summary.input_tax).toBe('-34.00');
      expect(report.summary.net_tax_payable).toBe('136.00');
      expect(report.summary.net_tax_refundable).toBe('0.00');
      await expect(new services.SalesTaxReportService(companyId).getSalesTax({ date_from: '2025-09-01', date_to: '2025-08-01' }))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ---------------- Stock Ledger and Stock Valuation ----------------

  describe('Stock Ledger', () => {
    it('carries opening quantity and value and keeps a running balance', async () => {
      const report = new services.StockReportService(companyId, allScope());
      const ledger = await report.getStockLedger({ item_id: itemId, date_from: '2025-08-05', date_to: '2025-08-31' });
      expect(ledger.opening_quantity).toBe('10.0000');
      expect(ledger.opening_value).toBe('1000.00');
      expect(ledger.lines.map(line => line.document_number?.slice(0, 2))).toEqual(['SI', 'SR', 'PR']);
      expect(ledger.total_quantity_in).toBe('1.0000');
      expect(ledger.total_quantity_out).toBe('6.0000');
      expect(ledger.closing_quantity).toBe('5.0000');

      let quantity = new Decimal(ledger.opening_quantity);
      let value = new Decimal(ledger.opening_value);
      for (const line of ledger.lines) {
        quantity = quantity.plus(line.quantity_in).minus(line.quantity_out);
        value = new Decimal(line.quantity_in).gt(0) ? value.plus(line.value) : value.minus(line.value);
        expect(line.balance_quantity).toBe(quantity.toFixed(4));
        expect(line.balance_value).toBe(value.toFixed(2));
      }
      expect(ledger.closing_value).toBe(value.toFixed(2));
      expect(ledger.lines.at(-1)?.balance_value).toBe(ledger.closing_value);

      // The closing value agrees with the valuation on the same date.
      const valuation = await report.getStockValuation({ as_of_date: '2025-08-31' });
      expect(valuation.totals.value).toBe(ledger.closing_value);
      expect(valuation.totals.quantity).toBe(ledger.closing_quantity);
    });

    it('filters by warehouse and rejects bad requests', async () => {
      const report = new services.StockReportService(companyId, allScope());
      const second = await report.getStockLedger({ item_id: itemId, date_from: '2025-07-01', date_to: '2025-12-31', warehouse_id: warehouseTwoId });
      expect(second.lines).toHaveLength(1);
      expect(second.closing_quantity).toBe('3.0000');
      expect(second.closing_value).toBe('360.00');
      expect(second.lines[0].place).toBe('Second Warehouse');

      const whole = await report.getStockLedger({ item_id: itemId, date_from: '2025-07-01', date_to: '2025-12-31' });
      expect(whole.opening_quantity).toBe('0.0000');
      expect(whole.closing_quantity).toBe('6.0000');

      await expect(report.getStockLedger({ item_id: randomUUID(), date_from: '2025-07-01', date_to: '2025-12-31' }))
        .rejects.toMatchObject({ statusCode: 404 });
      await expect(report.getStockLedger({ item_id: itemId, date_from: '2025-12-31', date_to: '2025-07-01' }))
        .rejects.toMatchObject({ statusCode: 400 });
      await expect(report.getStockLedger({ item_id: itemId, date_from: '2025-07-01', date_to: '2025-12-31', warehouse_id: warehouseOneId, branch_id: randomUUID() }))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('Stock Valuation', () => {
    it('values each warehouse and matches the Inventory account for All Branches', async () => {
      const report = new services.StockReportService(companyId, allScope());
      const valuation = await report.getStockValuation({ as_of_date: '2025-12-31' });
      expect(valuation.totals.quantity).toBe('6.0000');
      expect(valuation.totals.line_count).toBe(2);
      const places = Object.fromEntries(valuation.lines.map(line => [line.place_name, line]));
      expect(places['Main Warehouse'].quantity).toBe('3.0000');
      expect(places['Second Warehouse']).toMatchObject({ quantity: '3.0000', value: '360.00', average_cost: '120.0000', place_kind: 'Warehouse' });

      expect(valuation.ledger_check).not.toBeNull();
      expect(valuation.ledger_check).toMatchObject({ difference: '0.00', is_matched: true, opening_stock_value: '0.00' });
      expect(valuation.ledger_check!.stock_value).toBe(valuation.totals.value);
      expect(valuation.ledger_check!.inventory_account_balance).toBe(valuation.totals.value);

      const early = await report.getStockValuation({ as_of_date: '2025-08-05' });
      expect(early.totals).toEqual({ quantity: '10.0000', value: '1000.00', line_count: 1 });
      expect(early.ledger_check?.is_matched).toBe(true);
    });

    it('limits Warehouse and Branch users to their own place without the ledger check', async () => {
      const warehouseScope: Scope = { ...allScope(), role: 'warehouse_staff', accessLevel: 'WAREHOUSE', warehouseId: warehouseTwoId };
      const report = new services.StockReportService(companyId, warehouseScope);
      const valuation = await report.getStockValuation({ as_of_date: '2025-12-31' });
      expect(valuation.lines.map(line => line.place_name)).toEqual(['Second Warehouse']);
      expect(valuation.ledger_check).toBeNull();
      await expect(report.getStockValuation({ as_of_date: '2025-12-31', warehouse_id: warehouseOneId })).rejects.toMatchObject({ statusCode: 403 });
      await expect(report.getStockLedger({ item_id: itemId, date_from: '2025-07-01', date_to: '2025-12-31', branch_id: randomUUID() }))
        .rejects.toMatchObject({ statusCode: 403 });
      const ownLedger = await report.getStockLedger({ item_id: itemId, date_from: '2025-07-01', date_to: '2025-12-31' });
      expect(ownLedger.closing_quantity).toBe('3.0000');

      const branchId = randomUUID();
      const branchScope: Scope = { ...allScope(), role: 'sales_staff', accessLevel: 'BRANCH', branchId };
      const branchReport = new services.StockReportService(companyId, branchScope);
      await expect(branchReport.getStockValuation({ as_of_date: '2025-12-31', warehouse_id: warehouseOneId })).rejects.toMatchObject({ statusCode: 403 });
      const branchValuation = await branchReport.getStockValuation({ as_of_date: '2025-12-31' });
      expect(branchValuation.lines).toHaveLength(0);
      expect(branchValuation.ledger_check).toBeNull();

      // All Branches with a place filter has no company-wide ledger check.
      const filtered = await new services.StockReportService(companyId, allScope()).getStockValuation({ as_of_date: '2025-12-31', warehouse_id: warehouseOneId });
      expect(filtered.ledger_check).toBeNull();
      expect(filtered.totals.quantity).toBe('3.0000');
    });
  });

  // ---------------- Book Accounts ----------------

  describe('Book Accounts', () => {
    it('lists bank accounts from Bank Accounts and cash accounts without them', async () => {
      const books = new services.BookAccountsService(companyId);
      const bank = await books.list({ kind: 'bank' });
      expect(bank).toEqual([expect.objectContaining({ account_id: bankLedgerAccountId, label: 'Test National Bank - Main Current' })]);

      const cash = await books.list({ kind: 'cash' });
      const cashIds = cash.map(row => row.account_id);
      expect(cashIds).toContain(cashAccountId);
      expect(cashIds).not.toContain(bankLedgerAccountId);
      expect(cashIds).not.toContain(customers.one.accountId);

      expect(await books.list({ kind: 'bank', search: 'National' })).toHaveLength(1);
      expect(await books.list({ kind: 'bank', search: 'no-such-bank' })).toHaveLength(0);
    });

    it('lists customer and supplier linked accounts with search', async () => {
      const books = new services.BookAccountsService(companyId);
      const customerRows = await books.list({ kind: 'customer' });
      expect(customerRows.map(row => row.label)).toEqual(['CUS-1 - Customer One', 'CUS-3 - Customer Three', 'CUS-2 - Customer Two']);
      expect(customerRows[0].account_id).toBe(customers.one.accountId);

      const searched = await books.list({ kind: 'customer', search: 'Two' });
      expect(searched.map(row => row.account_id)).toEqual([customers.two.accountId]);
      expect((await books.list({ kind: 'customer', search: '0103010003' })).map(row => row.account_id)).toEqual([customers.three.accountId]);

      const suppliers = await books.list({ kind: 'supplier' });
      expect(suppliers).toEqual([expect.objectContaining({ account_id: supplierAccountId, account_code: '0201010001', label: 'SUP-1 - Supplier One' })]);
    });
  });

  // ---------------- Dashboard KPIs ----------------

  describe('Dashboard KPIs', () => {
    it('shows fiscal-year profit with last-year comparison and current position', async () => {
      // A cash sale today in the current fiscal year.
      const todaySaleId = await insertSaleDraft(today, customers.two, 'Cash', 1, 300, 0, Number(today.slice(0, 4)));
      await new services.SalePostService(companyId).post(todaySaleId, userId);
      const todayCost = await costOf('sale_invoices', todaySaleId);

      const kpis = await new services.DashboardKpiService(companyId).kpis();
      expect(kpis.period.date_to).toBe(today);
      const fyStartYear = Number(today.slice(5, 7)) >= 7 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
      expect(kpis.period.date_from).toBe(`${fyStartYear}-07-01`);
      expect(kpis.comparison_period.date_from).toBe(`${fyStartYear - 1}-07-01`);

      // Current year: only today's sale.
      expect(kpis.profit.revenue).toBe('300.00');
      expect(kpis.profit.cost_of_goods_sold).toBe(todayCost.toFixed(2));
      expect(kpis.profit.gross_profit).toBe(new Decimal(300).minus(todayCost).toFixed(2));
      expect(kpis.profit.net_profit).toBe(new Decimal(300).minus(todayCost).toFixed(2));
      expect(kpis.profit.gross_margin_percent).toBe(new Decimal(300).minus(todayCost).div(300).times(100).toFixed(1));

      // Comparison: the same days of the year before.
      const { date_from: from, date_to: to } = kpis.comparison_period;
      const earlier = [
        { date: '2025-08-10', revenue: new Decimal(800), cost: await costOf('sale_invoices', saleIds.one) },
        { date: '2025-08-15', revenue: new Decimal(-200), cost: (await costOf('sale_returns', saleReturnId)).negated() },
        { date: '2025-10-20', revenue: new Decimal(200), cost: await costOf('sale_invoices', saleIds.two) },
      ].filter(row => row.date >= from && row.date <= to);
      const previousRevenue = earlier.reduce((sum, row) => sum.plus(row.revenue), new Decimal(0));
      const previousProfit = earlier.reduce((sum, row) => sum.plus(row.revenue).minus(row.cost), new Decimal(0));
      expect(kpis.profit.previous_revenue).toBe(previousRevenue.toFixed(2));
      expect(kpis.profit.previous_net_profit).toBe(previousProfit.toFixed(2));
      expect(kpis.profit.revenue_change_percent).toBe(previousRevenue.isZero()
        ? null
        : new Decimal(300).minus(previousRevenue).div(previousRevenue.abs()).times(100).toDecimalPlaces(1).toFixed(1));

      // Position as of today: receivables net of advance, payables, cash and bank, stock value.
      // Customer One 602 + Customer Two -500 + Customer Three 150.
      expect(kpis.position.receivables).toBe('252.00');
      expect(kpis.position.payables).toBe('396.00');
      // Cash: +300 +500 -900 receipts/payment and +300 cash sale today.
      expect(kpis.position.cash_and_bank).toBe('200.00');
      expect(kpis.position.stock_value).toBe((await snapshotStockValue()).toFixed(2));

      // Stock valuation as of today still matches the ledger.
      const valuation = await new services.StockReportService(companyId, allScope()).getStockValuation({ as_of_date: today });
      expect(valuation.ledger_check?.is_matched).toBe(true);
      expect(valuation.totals.value).toBe(kpis.position.stock_value);
    });
  });
});
