/**
 * Ledger integrity tests against a real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env).
 * They work inside their own new company and delete it afterwards, so existing companies are untouched.
 */
import { randomUUID } from 'node:crypto';
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

describe.skipIf(!databaseUrl)('Ledger integrity (database)', () => {
  // Modules are imported after DATABASE_URL points at the test database.
  let prisma: typeof import('../src/db/prisma.js')['prisma'];
  let services: {
    PurchasePostService: typeof import('../src/modules/purchases/purchase-post.service.js')['PurchasePostService'];
    PurchaseReturnPostService: typeof import('../src/modules/purchase-returns/purchase-return-post.service.js')['PurchaseReturnPostService'];
    SalePostService: typeof import('../src/modules/sales/sale-post.service.js')['SalePostService'];
    SaleReturnPostService: typeof import('../src/modules/sale-returns/sale-return-post.service.js')['SaleReturnPostService'];
    StockAdjustmentService: typeof import('../src/modules/stock-adjustments/stock-adjustment.service.js')['StockAdjustmentService'];
    VoucherService: typeof import('../src/modules/vouchers/voucher.service.js')['VoucherService'];
    FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
    PostingAccountSettingsService: typeof import('../src/modules/settings/posting-account-settings.service.js')['PostingAccountSettingsService'];
    TrialBalanceReportService: typeof import('../src/modules/reports/trial-balance-report.service.js')['TrialBalanceReportService'];
    LedgerReportService: typeof import('../src/modules/reports/ledger-report.service.js')['LedgerReportService'];
    BalanceSheetReportService: typeof import('../src/modules/reports/balance-sheet-report.service.js')['BalanceSheetReportService'];
    ProfitAndLossReportService: typeof import('../src/modules/reports/profit-and-loss-report.service.js')['ProfitAndLossReportService'];
    AccountListService: typeof import('../src/modules/accounts/account-list.service.js')['AccountListService'];
  };

  const userId = randomUUID();
  let testCompany: TestCompany;
  let companyId = '';
  let supplierId = '';
  let supplierAccountId = '';
  let customerId = '';
  let customerAccountId = '';
  let warehouseId = '';
  let itemId = '';
  let inventoryAccountId = '';
  let fiscalYearOneId = '';
  let sequence = 0;

  const nextNumber = (prefix: string, year = 2025) => `${prefix}-${year}-${String(++sequence).padStart(4, '0')}`;

  beforeAll(async () => {
    testCompany = await createTestCompany('Ledger Integrity');
    prisma = testCompany.prisma;
    companyId = testCompany.companyId;
    services = {
      PurchasePostService: (await import('../src/modules/purchases/purchase-post.service.js')).PurchasePostService,
      PurchaseReturnPostService: (await import('../src/modules/purchase-returns/purchase-return-post.service.js')).PurchaseReturnPostService,
      SalePostService: (await import('../src/modules/sales/sale-post.service.js')).SalePostService,
      SaleReturnPostService: (await import('../src/modules/sale-returns/sale-return-post.service.js')).SaleReturnPostService,
      StockAdjustmentService: (await import('../src/modules/stock-adjustments/stock-adjustment.service.js')).StockAdjustmentService,
      VoucherService: (await import('../src/modules/vouchers/voucher.service.js')).VoucherService,
      FiscalYearService: (await import('../src/modules/fiscal-years/fiscal-year.service.js')).FiscalYearService,
      PostingAccountSettingsService: (await import('../src/modules/settings/posting-account-settings.service.js')).PostingAccountSettingsService,
      TrialBalanceReportService: (await import('../src/modules/reports/trial-balance-report.service.js')).TrialBalanceReportService,
      LedgerReportService: (await import('../src/modules/reports/ledger-report.service.js')).LedgerReportService,
      BalanceSheetReportService: (await import('../src/modules/reports/balance-sheet-report.service.js')).BalanceSheetReportService,
      ProfitAndLossReportService: (await import('../src/modules/reports/profit-and-loss-report.service.js')).ProfitAndLossReportService,
      AccountListService: (await import('../src/modules/accounts/account-list.service.js')).AccountListService,
    };

    const fiscalYears = new services.FiscalYearService(companyId);
    const yearOne = await fiscalYears.create({
      fiscal_year: '2025-2026', year_basis: 'july', start_date: '2025-07-01', end_date: '2026-06-30',
      number_of_periods: 12, posting_cutoff_days: 0,
    });
    fiscalYearOneId = yearOne.fiscal_year.id;
    await fiscalYears.create({
      fiscal_year: '2026-2027', year_basis: 'july', start_date: '2026-07-01', end_date: '2027-06-30',
      number_of_periods: 12, posting_cutoff_days: 0,
    });

    // Default posting accounts (cash, inventory, revenue, COGS, discount, adjustments, retained earnings).
    const settings = await new services.PostingAccountSettingsService(companyId).get();
    inventoryAccountId = String(settings.purchase?.default_inventory_account_id);

    supplierAccountId = await insertAccount('0201010001', 'Supplier Payable - Test Supplier', 'Liability', 'Credit');
    customerAccountId = await insertAccount('0103010001', 'Customer Receivable - Test Customer', 'Asset', 'Debit');
    const supplierRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO suppliers (company_id, code, name, ap_account_id)
      VALUES (CAST(${companyId} AS uuid), 'SUP-1', 'Test Supplier', CAST(${supplierAccountId} AS uuid)) RETURNING id
    `;
    supplierId = supplierRows[0].id;
    const customerRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO customers (company_id, code, name, ar_account_id)
      VALUES (CAST(${companyId} AS uuid), 'CUS-1', 'Test Customer', CAST(${customerAccountId} AS uuid)) RETURNING id
    `;
    customerId = customerRows[0].id;
    const warehouseRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO inventory_warehouses (company_id, code, name) VALUES (CAST(${companyId} AS uuid), 'WH-1', 'Main Warehouse') RETURNING id
    `;
    warehouseId = warehouseRows[0].id;
    const itemRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO inventory_items (company_id, item_code, item_name) VALUES (CAST(${companyId} AS uuid), 'ITEM-1', 'Test Item') RETURNING id
    `;
    itemId = itemRows[0].id;
  }, 120000);

  afterAll(async () => {
    await testCompany?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  async function insertAccount(code: string, name: string, accountType: string, normalBalance: string) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO accounts (company_id, code, name, account_type, normal_balance, is_posting, is_active, updated_at)
      VALUES (CAST(${companyId} AS uuid), ${code}, ${name}, ${accountType}, ${normalBalance}, true, true, now())
      RETURNING id
    `;
    return rows[0].id;
  }

  async function insertPurchaseDraft(date: string, quantity: number, price: number, discount: number) {
    const gross = new Decimal(quantity).times(price);
    const net = gross.minus(discount);
    const number = nextNumber('PI');
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO purchase_invoices (
        company_id, purchase_number, purchase_date, supplier_id, supplier_account_id, payment_type, warehouse_id,
        gross_amount, discount_amount, tax_amount, freight_amount, net_amount, status
      )
      VALUES (
        CAST(${companyId} AS uuid), ${number}, CAST(${date} AS date), CAST(${supplierId} AS uuid), CAST(${supplierAccountId} AS uuid),
        'Credit', CAST(${warehouseId} AS uuid), ${gross.toFixed(2)}::numeric, ${discount}::numeric, 0, 0, ${net.toFixed(2)}::numeric, 'Draft'
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
        ${quantity}::numeric, ${price}::numeric, ${discount}::numeric, 0, ${net.toFixed(2)}::numeric
      )
    `;
    return rows[0].id;
  }

  async function insertSaleDraft(date: string, quantity: number, price: number, draftUnitCost: number) {
    const gross = new Decimal(quantity).times(price);
    const draftCost = new Decimal(quantity).times(draftUnitCost);
    const number = nextNumber('SI');
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO sale_invoices (
        company_id, sale_number, sale_date, customer_id, customer_account_id, payment_type, warehouse_id,
        gross_amount, discount_amount, tax_amount, freight_amount, net_amount, cost_amount, status
      )
      VALUES (
        CAST(${companyId} AS uuid), ${number}, CAST(${date} AS date), CAST(${customerId} AS uuid), CAST(${customerAccountId} AS uuid),
        'Credit', CAST(${warehouseId} AS uuid), ${gross.toFixed(2)}::numeric, 0, 0, 0, ${gross.toFixed(2)}::numeric,
        ${draftCost.toFixed(2)}::numeric, 'Draft'
      )
      RETURNING id
    `;
    await prisma.$executeRaw`
      INSERT INTO sale_invoice_lines (
        company_id, sale_invoice_id, line_number, item_id, item_code, item_name, warehouse_id,
        quantity, sale_price, unit_cost, cost_amount, line_total
      )
      VALUES (
        CAST(${companyId} AS uuid), CAST(${rows[0].id} AS uuid), 1, CAST(${itemId} AS uuid), 'ITEM-1', 'Test Item', CAST(${warehouseId} AS uuid),
        ${quantity}::numeric, ${price}::numeric, ${draftUnitCost}::numeric, ${draftCost.toFixed(2)}::numeric, ${gross.toFixed(2)}::numeric
      )
    `;
    return rows[0].id;
  }

  async function insertSaleReturnDraft(date: string, quantity: number, price: number) {
    const gross = new Decimal(quantity).times(price);
    const number = nextNumber('SR');
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO sale_returns (
        company_id, sale_return_number, sale_return_date, customer_id, customer_account_id, payment_type, warehouse_id,
        gross_amount, discount_amount, tax_amount, freight_amount, net_amount, cost_amount, status
      )
      VALUES (
        CAST(${companyId} AS uuid), ${number}, CAST(${date} AS date), CAST(${customerId} AS uuid), CAST(${customerAccountId} AS uuid),
        'Credit', CAST(${warehouseId} AS uuid), ${gross.toFixed(2)}::numeric, 0, 0, 0, ${gross.toFixed(2)}::numeric, 0, 'Draft'
      )
      RETURNING id
    `;
    await prisma.$executeRaw`
      INSERT INTO sale_return_lines (
        company_id, sale_return_id, line_number, item_id, item_code, item_name, warehouse_id,
        quantity, sale_price, unit_cost, cost_amount, line_total
      )
      VALUES (
        CAST(${companyId} AS uuid), CAST(${rows[0].id} AS uuid), 1, CAST(${itemId} AS uuid), 'ITEM-1', 'Test Item', CAST(${warehouseId} AS uuid),
        ${quantity}::numeric, ${price}::numeric, 0, 0, ${gross.toFixed(2)}::numeric
      )
    `;
    return rows[0].id;
  }

  async function insertPurchaseReturnDraft(date: string, quantity: number, price: number) {
    const gross = new Decimal(quantity).times(price);
    const number = nextNumber('PR');
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO purchase_returns (
        company_id, purchase_return_number, purchase_return_date, supplier_id, supplier_account_id, payment_type, warehouse_id,
        gross_amount, discount_amount, tax_amount, freight_amount, net_amount, status
      )
      VALUES (
        CAST(${companyId} AS uuid), ${number}, CAST(${date} AS date), CAST(${supplierId} AS uuid), CAST(${supplierAccountId} AS uuid),
        'Credit', CAST(${warehouseId} AS uuid), ${gross.toFixed(2)}::numeric, 0, 0, 0, ${gross.toFixed(2)}::numeric, 'Draft'
      )
      RETURNING id
    `;
    await prisma.$executeRaw`
      INSERT INTO purchase_return_lines (
        company_id, purchase_return_id, line_number, item_id, item_code, item_name, warehouse_id,
        quantity, purchase_price, discount_amount, tax_amount, line_total
      )
      VALUES (
        CAST(${companyId} AS uuid), CAST(${rows[0].id} AS uuid), 1, CAST(${itemId} AS uuid), 'ITEM-1', 'Test Item', CAST(${warehouseId} AS uuid),
        ${quantity}::numeric, ${price}::numeric, 0, 0, ${gross.toFixed(2)}::numeric
      )
    `;
    return rows[0].id;
  }

  async function insertAdjustmentDraft(date: string, lines: Array<{ type: 'Increase' | 'Decrease'; quantity: number; unitCost: number }>) {
    const number = nextNumber('SA');
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO stock_adjustments (company_id, adjustment_number, adjustment_date, warehouse_id, status)
      VALUES (CAST(${companyId} AS uuid), ${number}, CAST(${date} AS date), CAST(${warehouseId} AS uuid), 'Draft')
      RETURNING id
    `;
    for (const [index, line] of lines.entries()) {
      await prisma.$executeRaw`
        INSERT INTO stock_adjustment_lines (
          company_id, stock_adjustment_id, line_number, adjustment_type, item_id, item_code, item_name, quantity, unit_cost
        )
        VALUES (
          CAST(${companyId} AS uuid), CAST(${rows[0].id} AS uuid), ${index + 1}, ${line.type}, CAST(${itemId} AS uuid),
          'ITEM-1', 'Test Item', ${line.quantity}::numeric, ${line.unitCost}::numeric
        )
      `;
    }
    return rows[0].id;
  }

  async function stockValue() {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT COALESCE(SUM(total_stock_value), 0)::text AS value
      FROM inventory_stock_balances
      WHERE company_id = CAST(${companyId} AS uuid)
    `;
    return new Decimal(rows[0].value);
  }

  async function trialBalance(dateFrom: string, dateTo: string) {
    return new services.TrialBalanceReportService(companyId).getTrialBalance({
      date_from: dateFrom, date_to: dateTo, include_zero_balances: false,
    });
  }

  /** GL Inventory must equal stock value and the Trial Balance must balance after every posting. */
  async function expectLedgerMatchesStock(asOf: string) {
    const tb = await trialBalance('2025-07-01', asOf);
    expect(tb.totals.difference).toBe('0.00');
    const inventory = tb.lines.find(line => line.account_id === inventoryAccountId);
    const glInventory = new Decimal(inventory?.closing_debit ?? '0').minus(inventory?.closing_credit ?? '0');
    expect(glInventory.toFixed(2)).toBe((await stockValue()).toFixed(2));
  }

  async function voucherFor(table: 'purchase_invoices' | 'sale_invoices' | 'sale_returns' | 'purchase_returns' | 'stock_adjustments', id: string) {
    const rows = await prisma.$queryRawUnsafe<{ accounting_voucher_id: string }[]>(
      `SELECT accounting_voucher_id FROM ${table} WHERE id = CAST($1 AS uuid)`, id,
    );
    return prisma.voucher.findUniqueOrThrow({ where: { id: rows[0].accounting_voucher_id }, include: { lines: true } });
  }

  async function postApprovedJournal(date: string, debitAccountId: string, creditAccountId: string, amount: number) {
    const accounts = await prisma.account.findMany({ where: { id: { in: [debitAccountId, creditAccountId] } } });
    const byId = new Map(accounts.map(account => [account.id, account]));
    const vouchers = new services.VoucherService(companyId);
    const draft = await vouchers.create({
      voucher_type: 'JV', voucher_date: date, submit_for_approval: true,
      lines: [
        { account_id: debitAccountId, account_code: byId.get(debitAccountId)!.code, account_name: byId.get(debitAccountId)!.name, dr_amount: amount, cr_amount: 0, line_no: 1 },
        { account_id: creditAccountId, account_code: byId.get(creditAccountId)!.code, account_name: byId.get(creditAccountId)!.name, dr_amount: 0, cr_amount: amount, line_no: 2 },
      ],
    }, userId);
    await vouchers.approve(draft.id, {}, randomUUID());
    return vouchers.post(draft.id, userId);
  }

  it('posts a discounted purchase with Inventory equal to stock value (DATA-003)', async () => {
    const id = await insertPurchaseDraft('2025-08-01', 10, 100, 50);
    await new services.PurchasePostService(companyId).post(id, userId);

    const voucher = await voucherFor('purchase_invoices', id);
    expect(voucher.totalDebit.toFixed(2)).toBe('1000.00');
    expect(voucher.totalCredit.toFixed(2)).toBe('1000.00');
    expect((await stockValue()).toFixed(2)).toBe('1000.00');
    await expectLedgerMatchesStock('2025-08-31');
  });

  it('costs a sale at posting time, not at the stale draft cost (DATA-004)', async () => {
    const secondPurchase = await insertPurchaseDraft('2025-08-05', 5, 130, 0);
    await new services.PurchasePostService(companyId).post(secondPurchase, userId);

    // Draft saved with an old unit cost of 50; the real average is 1650 / 15 = 110.
    const saleId = await insertSaleDraft('2025-08-10', 3, 200, 50);
    await new services.SalePostService(companyId).post(saleId, userId);

    const voucher = await voucherFor('sale_invoices', saleId);
    const cogs = voucher.lines.find(line => line.accountCode.startsWith('0501'));
    expect(cogs?.debitAmount.toFixed(2)).toBe('330.00');
    const sale = await prisma.$queryRaw<{ cost_amount: string }[]>`SELECT cost_amount::text FROM sale_invoices WHERE id = CAST(${saleId} AS uuid)`;
    expect(new Decimal(sale[0].cost_amount).toFixed(2)).toBe('330.00');
    await expectLedgerMatchesStock('2025-08-31');
  });

  it('keeps GL and stock equal through purchase returns, sale returns and adjustments', async () => {
    const purchaseReturn = await insertPurchaseReturnDraft('2025-08-12', 2, 130);
    await new services.PurchaseReturnPostService(companyId).post(purchaseReturn, userId);
    await expectLedgerMatchesStock('2025-08-31');

    const saleReturn = await insertSaleReturnDraft('2025-08-14', 1, 200);
    await new services.SaleReturnPostService(companyId).post(saleReturn, userId);
    await expectLedgerMatchesStock('2025-08-31');

    const adjustment = await insertAdjustmentDraft('2025-08-15', [
      { type: 'Decrease', quantity: 1, unitCost: 0 },
      { type: 'Increase', quantity: 2, unitCost: 90 },
    ]);
    await new services.StockAdjustmentService(companyId).post(adjustment, userId);
    await expectLedgerMatchesStock('2025-08-31');
  });

  it('issues the whole remaining value when all stock is sold', async () => {
    const balance = await prisma.$queryRaw<{ stock_on_hand: string }[]>`
      SELECT stock_on_hand::text FROM inventory_stock_balances WHERE company_id = CAST(${companyId} AS uuid)
    `;
    const saleId = await insertSaleDraft('2025-08-20', Number(balance[0].stock_on_hand), 150, 1);
    await new services.SalePostService(companyId).post(saleId, userId);
    expect((await stockValue()).toFixed(2)).toBe('0.00');
    await expectLedgerMatchesStock('2025-08-31');

    // Stock back for later tests.
    const refill = await insertPurchaseDraft('2025-08-21', 4, 100, 0);
    await new services.PurchasePostService(companyId).post(refill, userId);
  });

  it('does not overwrite saved Stock Adjustment accounts when posting (DATA-005)', async () => {
    const customGainId = await insertAccount('0401300199', 'Custom Adjustment Gain', 'Revenue', 'Credit');
    await prisma.$executeRaw`
      UPDATE stock_adjustment_settings SET adjustment_gain_account_id = CAST(${customGainId} AS uuid)
      WHERE company_id = CAST(${companyId} AS uuid)
    `;
    const adjustment = await insertAdjustmentDraft('2025-08-22', [{ type: 'Increase', quantity: 1, unitCost: 100 }]);
    await new services.StockAdjustmentService(companyId).post(adjustment, userId);

    const settings = await prisma.$queryRaw<{ adjustment_gain_account_id: string }[]>`
      SELECT adjustment_gain_account_id::text FROM stock_adjustment_settings WHERE company_id = CAST(${companyId} AS uuid)
    `;
    expect(settings[0].adjustment_gain_account_id).toBe(customGainId);
    const voucher = await voucherFor('stock_adjustments', adjustment);
    expect(voucher.lines.some(line => line.accountId === customGainId)).toBe(true);
    await expectLedgerMatchesStock('2025-08-31');
  });

  it('rejects voiding a posted voucher and reverses it with a linked RV voucher (DATA-001)', async () => {
    const settings = await new services.PostingAccountSettingsService(companyId).get();
    const cashId = String(settings.purchase?.default_cash_account_id);
    const posted = await postApprovedJournal('2025-09-01', cashId, customerAccountId, 250);
    const vouchers = new services.VoucherService(companyId);

    await expect(vouchers.void(posted.id, 'mistake', userId)).rejects.toThrow(/cannot be voided/);

    const reversal = await vouchers.reverse(posted.id, { reversal_date: '2025-09-02', reason: 'Wrong customer' }, userId);
    expect(reversal.voucher_type).toBe('RV');
    expect(reversal.voucher_number).toMatch(/^RV-2025-\d{4}$/);
    expect(reversal.reversal_of_voucher_id).toBe(posted.id);
    expect(reversal.lines[0].cr_amount).toBe('250');

    const original = await vouchers.getById(posted.id);
    expect(original.status).toBe('Posted');
    expect(original.reversed_by_voucher_id).toBe(reversal.id);

    const ledger = await new services.LedgerReportService(companyId).getAccountLedger({
      account_id: cashId, date_from: '2025-09-01', date_to: '2025-09-30',
    });
    expect(ledger.total_debit).toBe(ledger.total_credit);

    await expect(vouchers.reverse(posted.id, { reversal_date: '2025-09-03', reason: 'again' }, userId)).rejects.toThrow(/already reversed/);
    await expect(vouchers.reverse(reversal.id, { reversal_date: '2025-09-03', reason: 'again' }, userId)).rejects.toThrow(/cannot be reversed/);
  });

  it('blocks reversing vouchers created by business documents', async () => {
    const id = await insertPurchaseDraft('2025-09-05', 1, 100, 0);
    await new services.PurchasePostService(companyId).post(id, userId);
    const voucher = await voucherFor('purchase_invoices', id);
    await expect(new services.VoucherService(companyId).reverse(voucher.id, { reversal_date: '2025-09-06', reason: 'x' }, userId))
      .rejects.toThrow(/cannot be reversed/);
  });

  it('rejects manual vouchers that do not balance to the cent (DATA-007)', async () => {
    const settings = await new services.PostingAccountSettingsService(companyId).get();
    const cashId = String(settings.purchase?.default_cash_account_id);
    const accounts = await prisma.account.findMany({ where: { id: { in: [cashId, customerAccountId] } } });
    const byId = new Map(accounts.map(account => [account.id, account]));
    await expect(new services.VoucherService(companyId).create({
      voucher_type: 'JV', voucher_date: '2025-09-10', submit_for_approval: false,
      lines: [
        { account_id: cashId, account_code: byId.get(cashId)!.code, account_name: byId.get(cashId)!.name, dr_amount: 100.01, cr_amount: 0, line_no: 1 },
        { account_id: customerAccountId, account_code: byId.get(customerAccountId)!.code, account_name: byId.get(customerAccountId)!.name, dr_amount: 0, cr_amount: 100, line_no: 2 },
      ],
    }, userId)).rejects.toThrow(/not balanced/);
  });

  it('includes an opening balance dated inside the report range (DATA-014)', async () => {
    const capitalId = await insertAccount('0301100199', 'Owner Capital Test', 'Equity', 'Credit');
    const savingsId = await insertAccount('0101100199', 'Opening Cash Test', 'Asset', 'Debit');
    await prisma.$executeRaw`
      UPDATE accounts SET opening_balance = 5000, opening_balance_date = '2025-09-15'
      WHERE id IN (CAST(${capitalId} AS uuid), CAST(${savingsId} AS uuid))
    `;

    const tb = await trialBalance('2025-07-01', '2025-12-31');
    expect(tb.totals.difference).toBe('0.00');
    const savings = tb.lines.find(line => line.account_id === savingsId);
    expect(savings?.opening_debit).toBe('0.00');
    expect(savings?.period_debit).toBe('5000.00');
    expect(savings?.closing_debit).toBe('5000.00');

    const ledger = await new services.LedgerReportService(companyId).getAccountLedger({
      account_id: savingsId, date_from: '2025-07-01', date_to: '2025-12-31',
    });
    expect(ledger.lines[0].voucher_number).toBe('Opening Balance');
    expect(ledger.closing_balance).toBe('5000.00');

    const before = await trialBalance('2025-07-01', '2025-09-14');
    expect(before.lines.find(line => line.account_id === savingsId)).toBeUndefined();
  });

  it('shows Chart of Accounts balances on the normal side (DATA-016)', async () => {
    const result = await new services.AccountListService().list(companyId, { page: 1, limit: 200, search: '0201010001' } as never);
    const supplier = (result.data as Array<{ id: string; current_balance: string }>).find(row => row.id === supplierAccountId);
    const tb = await trialBalance('2025-07-01', '2026-06-30');
    const supplierLine = tb.lines.find(line => line.account_id === supplierAccountId);
    expect(new Decimal(supplier!.current_balance).gt(0)).toBe(true);
    expect(new Decimal(supplier!.current_balance).toFixed(2)).toBe(new Decimal(supplierLine!.closing_credit).toFixed(2));
  });

  it('closes the year into Retained Earnings and keeps the next Balance Sheet balanced (DATA-002)', async () => {
    const before = await new services.ProfitAndLossReportService(companyId).getProfitAndLoss({
      date_from: '2025-07-01', date_to: '2026-06-30', include_zero_balances: false,
    });
    const yearProfit = new Decimal(before.totals.net_profit).minus(before.totals.net_loss);
    expect(yearProfit.isZero()).toBe(false);

    // Before closing, the next year Balance Sheet carries last year's result on its own line.
    const unclosed = await new services.BalanceSheetReportService(companyId).getBalanceSheet({ as_of_date: '2026-07-31', include_zero_balances: false });
    expect(unclosed.totals.difference).toBe('0.00');
    expect(unclosed.lines.some(line => line.account_id === 'unclosed-prior-years-result')).toBe(true);

    const fiscalYears = new services.FiscalYearService(companyId);
    const check = await fiscalYears.preCloseCheck(fiscalYearOneId);
    const tbCheck = check.checks.find(item => item.key === 'trial_balance');
    expect(tbCheck?.status).toBe('Passed');
    for (const period of await fiscalYears.getPeriods(fiscalYearOneId)) {
      await fiscalYears.lockPeriod((period as { id: string }).id);
    }
    const closed = await fiscalYears.closeFiscalYear(fiscalYearOneId, {}, userId);
    expect(closed.closing_voucher_number).toMatch(/^CL-2026-\d{4}$/);

    const after = await new services.ProfitAndLossReportService(companyId).getProfitAndLoss({
      date_from: '2025-07-01', date_to: '2026-06-30', include_zero_balances: false,
    });
    expect(new Decimal(after.totals.net_profit).minus(after.totals.net_loss).toFixed(2)).toBe(yearProfit.toFixed(2));

    const yearEnd = await new services.BalanceSheetReportService(companyId).getBalanceSheet({ as_of_date: '2026-06-30', include_zero_balances: false });
    expect(yearEnd.totals.difference).toBe('0.00');
    const nextYear = await new services.BalanceSheetReportService(companyId).getBalanceSheet({ as_of_date: '2026-07-31', include_zero_balances: false });
    expect(nextYear.totals.difference).toBe('0.00');
    expect(nextYear.lines.some(line => line.account_id === 'unclosed-prior-years-result')).toBe(false);

    const settings = await new services.PostingAccountSettingsService(companyId).get();
    const retainedId = String(settings.year_end?.retained_earnings_account_id);
    const retained = nextYear.lines.find(line => line.account_id === retainedId);
    expect(new Decimal(retained?.amount ?? '0').toFixed(2)).toBe(yearProfit.toFixed(2));
  });

  it('blocks opening balance changes once a period on or after its date is closed (DATA-015)', async () => {
    const accountId = await insertAccount('0101100198', 'Opening Lock Test', 'Asset', 'Debit');
    const accounts = new services.AccountListService();
    await expect(accounts.update(companyId, accountId, { opening_balance: 100, opening_balance_date: '2025-09-15' }))
      .rejects.toThrow(/locked or closed/);
    await expect(accounts.update(companyId, accountId, { opening_balance: 100 }))
      .rejects.toThrow(/Opening Balance Date is required/);
    // Year two is still open, so an opening balance dated after year one is allowed.
    const updated = await accounts.update(companyId, accountId, { opening_balance: 100, opening_balance_date: '2026-07-01' });
    expect(updated.opening_balance).toBe('100');
  });

  it('refuses approval by the person who created or sent the voucher (AUTH-002)', async () => {
    const settings = await new services.PostingAccountSettingsService(companyId).get();
    const cashId = String(settings.purchase?.default_cash_account_id);
    const accounts = await prisma.account.findMany({ where: { id: { in: [cashId, customerAccountId] } } });
    const byId = new Map(accounts.map(account => [account.id, account]));
    const vouchers = new services.VoucherService(companyId);
    const draft = await vouchers.create({
      voucher_type: 'JV', voucher_date: '2026-08-01', submit_for_approval: true,
      lines: [
        { account_id: cashId, account_code: byId.get(cashId)!.code, account_name: byId.get(cashId)!.name, dr_amount: 10, cr_amount: 0, line_no: 1 },
        { account_id: customerAccountId, account_code: byId.get(customerAccountId)!.code, account_name: byId.get(customerAccountId)!.name, dr_amount: 0, cr_amount: 10, line_no: 2 },
      ],
    }, userId);
    await expect(vouchers.approve(draft.id, {}, userId)).rejects.toThrow(/another approver/i);
    await expect(vouchers.reject(draft.id, { reason: 'no' }, userId)).rejects.toThrow(/another approver/i);
    const approved = await vouchers.approve(draft.id, {}, randomUUID());
    expect(approved.approval_status).toBe('Approved');
  });

  it('numbers documents as numbers so 10000 follows 9999 (ARCH-002)', async () => {
    const { nextDocumentNumber } = await import('../src/modules/numbering/document-number.js');
    for (const number of ['SA-2031-9999', 'SA-2031-0002']) {
      await prisma.$executeRaw`
        INSERT INTO stock_adjustments (company_id, adjustment_number, adjustment_date, warehouse_id, status)
        VALUES (CAST(${companyId} AS uuid), ${number}, '2031-01-01', CAST(${warehouseId} AS uuid), 'Draft')
      `;
    }
    const next = await prisma.$transaction(tx => nextDocumentNumber(tx, { companyId, table: 'stock_adjustments', prefix: 'SA', year: 2031 }));
    expect(next).toBe('SA-2031-10000');
    const first = await prisma.$transaction(tx => nextDocumentNumber(tx, { companyId, table: 'stock_adjustments', prefix: 'SA', year: 2032 }));
    expect(first).toBe('SA-2032-0001');
  });
});
