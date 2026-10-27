/**
 * Sale Return document flow against a real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env):
 * validation -> draft -> posting back into a Branch, with stock valued at the Branch average cost, ledger,
 * numbering, list totals, access scope and closed periods. Everything runs inside a new test company that is deleted afterwards.
 */
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

type AccessScope = import('../src/modules/auth/access-rules.js').AccessScope;
type ReturnInput = import('../src/modules/sale-returns/sale-return-validation.service.js').ValidateSaleReturnInput;

describe.skipIf(!databaseUrl)('Sale Returns (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let userId = '';

  let m: {
    SaleReturnValidationService: typeof import('../src/modules/sale-returns/sale-return-validation.service.js')['SaleReturnValidationService'];
    ValidateSaleReturnInput: typeof import('../src/modules/sale-returns/sale-return-validation.service.js')['ValidateSaleReturnInput'];
    SaleReturnDraftService: typeof import('../src/modules/sale-returns/sale-return-draft.service.js')['SaleReturnDraftService'];
    SaleReturnPostService: typeof import('../src/modules/sale-returns/sale-return-post.service.js')['SaleReturnPostService'];
    SaleReturnListService: typeof import('../src/modules/sale-returns/sale-return-list.service.js')['SaleReturnListService'];
    ListSaleReturnsQuery: typeof import('../src/modules/sale-returns/sale-return-list.service.js')['ListSaleReturnsQuery'];
    SaleReturnDetailService: typeof import('../src/modules/sale-returns/sale-return-detail.service.js')['SaleReturnDetailService'];
    access: typeof import('../src/modules/inventory/stock-holder-access.js');
    FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
  };

  let fiscalYearId = '';
  let settings: { inventory: string; cash: string; revenue: string; tax: string; discount: string; freight: string; cogs: string };
  let customerId = '';
  let customerAccountId = '';
  let warehouseId = '';
  let branchOne = '';
  let branchTwo = '';
  let itemA = '';

  const allBranches = (): AccessScope => ({ companyId, userId, role: 'admin', accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null });
  const branchUser = (branchId: string): AccessScope => ({ companyId, userId, role: 'sales_staff', accessLevel: 'BRANCH', branchId, warehouseId: null });
  const warehouseUser = (): AccessScope => ({ companyId, userId, role: 'warehouse_staff', accessLevel: 'WAREHOUSE', branchId: null, warehouseId });

  beforeAll(async () => {
    company = await createTestCompany('Sale Returns');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;

    m = {
      SaleReturnValidationService: (await import('../src/modules/sale-returns/sale-return-validation.service.js')).SaleReturnValidationService,
      ValidateSaleReturnInput: (await import('../src/modules/sale-returns/sale-return-validation.service.js')).ValidateSaleReturnInput,
      SaleReturnDraftService: (await import('../src/modules/sale-returns/sale-return-draft.service.js')).SaleReturnDraftService,
      SaleReturnPostService: (await import('../src/modules/sale-returns/sale-return-post.service.js')).SaleReturnPostService,
      SaleReturnListService: (await import('../src/modules/sale-returns/sale-return-list.service.js')).SaleReturnListService,
      ListSaleReturnsQuery: (await import('../src/modules/sale-returns/sale-return-list.service.js')).ListSaleReturnsQuery,
      SaleReturnDetailService: (await import('../src/modules/sale-returns/sale-return-detail.service.js')).SaleReturnDetailService,
      access: await import('../src/modules/inventory/stock-holder-access.js'),
      FiscalYearService: (await import('../src/modules/fiscal-years/fiscal-year.service.js')).FiscalYearService,
    };
    const { PostingAccountSettingsService } = await import('../src/modules/settings/posting-account-settings.service.js');
    const { SupplierService } = await import('../src/modules/parties/supplier.service.js');
    const { CustomerService } = await import('../src/modules/parties/customer.service.js');
    const { supplierInputSchema, customerInputSchema } = await import('../src/modules/parties/party.schema.js');
    const { WarehouseService } = await import('../src/modules/inventory/warehouse.service.js');
    const { createWarehouseSchema } = await import('../src/modules/inventory/warehouse.schema.js');
    const { BranchService } = await import('../src/modules/branches/branch.service.js');
    const { createBranchSchema } = await import('../src/modules/branches/branch.schema.js');
    const { ProductService } = await import('../src/modules/inventory/product.service.js');
    const { createProductSchema } = await import('../src/modules/inventory/product.schema.js');
    const { PurchaseDraftService } = await import('../src/modules/purchases/purchase-draft.service.js');
    const { PurchasePostService } = await import('../src/modules/purchases/purchase-post.service.js');
    const { ValidatePurchaseInvoiceInput } = await import('../src/modules/purchases/purchase-validation.service.js');
    const { StockTransferService } = await import('../src/modules/stock-transfers/stock-transfer.service.js');
    const { ValidateStockTransferInput } = await import('../src/modules/stock-transfers/stock-transfer.schema.js');
    const { SaleDraftService } = await import('../src/modules/sales/sale-draft.service.js');
    const { SalePostService } = await import('../src/modules/sales/sale-post.service.js');
    const { ValidateSaleInvoiceInput } = await import('../src/modules/sales/sale-validation.service.js');

    const year = await new m.FiscalYearService(companyId).create({
      fiscal_year: '2025-2026', year_basis: 'july', start_date: '2025-07-01', end_date: '2026-06-30',
      number_of_periods: 12, posting_cutoff_days: 0,
    });
    fiscalYearId = year.fiscal_year.id;

    const posting = await new PostingAccountSettingsService(companyId).get();
    settings = {
      inventory: String(posting.sale?.default_inventory_account_id),
      cash: String(posting.sale?.default_cash_account_id),
      revenue: String(posting.sale?.sales_revenue_account_id),
      tax: String(posting.sale?.sales_tax_account_id),
      discount: String(posting.sale?.sales_discount_account_id),
      freight: String(posting.sale?.freight_income_account_id),
      cogs: String(posting.sale?.cost_of_goods_sold_account_id),
    };

    const supplier = await new SupplierService().create(companyId, supplierInputSchema.parse({ name: 'Return Test Supplier' }));
    const customer = await new CustomerService().create(companyId, customerInputSchema.parse({ name: 'Return Test Customer' }));
    customerId = customer.id;
    customerAccountId = String(customer.ar_account_id);

    const branches = new BranchService(companyId);
    branchOne = (await branches.create(createBranchSchema.parse({ code: 'BR-1', name: 'Shop One' }))).id;
    branchTwo = (await branches.create(createBranchSchema.parse({ code: 'BR-2', name: 'Shop Two' }))).id;
    warehouseId = (await new WarehouseService(companyId).create(createWarehouseSchema.parse({ code: 'WH-1', name: 'Main Warehouse' }))).id;
    // Standard cost 95 is only used when the Branch has no stock of the item to take an average from.
    itemA = (await new ProductService(companyId).create(createProductSchema.parse({ sku: 'SR-A', name: 'Returned Item', product_type: 'Finished', cost_price: 95 }))).id;

    // Shop One gets 10 @ 100 and sells 4, leaving 6 worth 600.00.
    const purchase = await new PurchaseDraftService(companyId).createDraft(ValidatePurchaseInvoiceInput.parse({
      purchase_date: '2025-07-10', supplier_id: supplier.id, payment_type: 'Cash', warehouse_id: warehouseId,
      lines: [{ item_id: itemA, quantity: 10, purchase_price: 100 }],
    }), userId);
    await new PurchasePostService(companyId).post(purchase.id, userId);
    await new StockTransferService(companyId).createAndPost(ValidateStockTransferInput.parse({
      transfer_date: '2025-07-11', from_warehouse_id: warehouseId, to_branch_id: branchOne, lines: [{ item_id: itemA, quantity: 10 }],
    }), userId);
    const sale = await new SaleDraftService(companyId).createDraft(ValidateSaleInvoiceInput.parse({
      sale_date: '2025-07-20', customer_id: customerId, payment_type: 'Credit', due_date: '2025-08-20', branch_id: branchOne,
      lines: [{ item_id: itemA, quantity: 4, sale_price: 150 }],
    }), userId);
    await new SalePostService(companyId).post(sale.id, userId);
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  function returnInput(overrides: Partial<ReturnInput> = {}): ReturnInput {
    return m.ValidateSaleReturnInput.parse({
      sale_return_date: '2025-08-01',
      customer_id: customerId,
      payment_type: 'Credit',
      branch_id: branchOne,
      lines: [{ item_id: itemA, quantity: 1, sale_price: 150 }],
      ...overrides,
    });
  }

  async function createDraft(overrides: Partial<ReturnInput> = {}) {
    return new m.SaleReturnDraftService(companyId).createDraft(returnInput(overrides), userId);
  }

  async function balance(branchId = branchOne) {
    const rows = await prisma.$queryRaw<{ stock_on_hand: string; total_stock_value: string }[]>`
      SELECT stock_on_hand::text, total_stock_value::text
      FROM inventory_stock_balances
      WHERE company_id = CAST(${companyId} AS uuid) AND item_id = CAST(${itemA} AS uuid) AND branch_id = CAST(${branchId} AS uuid)
    `;
    return rows[0] ? `${new Decimal(rows[0].stock_on_hand).toFixed(4)} @ ${new Decimal(rows[0].total_stock_value).toFixed(2)}` : null;
  }

  async function returnRow(id: string) {
    const rows = await prisma.$queryRaw<{ status: string; accounting_voucher_id: string | null; cost_amount: string }[]>`
      SELECT status, accounting_voucher_id::text, cost_amount::text
      FROM sale_returns WHERE company_id = CAST(${companyId} AS uuid) AND id = CAST(${id} AS uuid)
    `;
    return rows[0];
  }

  async function idByNumber(number: string) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text FROM sale_returns WHERE company_id = CAST(${companyId} AS uuid) AND sale_return_number = ${number}
    `;
    return rows[0].id;
  }

  async function voucherFor(id: string) {
    const row = await returnRow(id);
    return prisma.voucher.findUniqueOrThrow({ where: { id: String(row.accounting_voucher_id) }, include: { lines: true } });
  }

  function amountOn(voucher: Awaited<ReturnType<typeof voucherFor>>, accountId: string) {
    const lines = voucher.lines.filter(line => line.accountId === accountId);
    return {
      debit: lines.reduce((sum, line) => sum.plus(line.debitAmount.toString()), new Decimal(0)).toFixed(2),
      credit: lines.reduce((sum, line) => sum.plus(line.creditAmount.toString()), new Decimal(0)).toFixed(2),
    };
  }

  async function companyCount(table: 'inventory_stock_movements' | 'vouchers' | 'sale_returns') {
    const rows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM ${table} WHERE company_id = CAST($1 AS uuid)`, companyId,
    );
    return rows[0].total;
  }

  it('calculates gross, discount, tax, freight and net amounts', async () => {
    const result = await new m.SaleReturnValidationService(companyId).validate(returnInput({
      freight_amount: 5,
      lines: [{ item_id: itemA, quantity: 2, sale_price: 150, discount_amount: 20, tax_amount: 10 }],
    }));
    expect(result.errors).toEqual([]);
    expect(result.totals).toEqual({
      gross_amount: '300.00', discount_amount: '20.00', tax_amount: '10.00', freight_amount: '5.00', net_amount: '295.00',
    });
    expect(result.branch_id).toBe(branchOne);
  });

  it('saves a draft numbered SR-YYYY-NNNN without changing stock or the ledger', async () => {
    const movements = await companyCount('inventory_stock_movements');
    const vouchers = await companyCount('vouchers');
    const first = await createDraft({
      customer_return_number: 'CR-1',
      freight_amount: 5,
      lines: [{ item_id: itemA, quantity: 2, sale_price: 150, discount_amount: 20, tax_amount: 10 }],
    });
    const second = await createDraft({ sale_return_date: '2025-08-02' });
    expect(first.sale_return_number).toBe('SR-2025-0001');
    expect(second.sale_return_number).toBe('SR-2025-0002');

    const detail = await new m.SaleReturnDetailService(companyId).getById(first.id);
    expect(detail.status).toBe('Draft');
    expect(detail.branch_id).toBe(branchOne);
    expect(new Decimal(detail.net_amount).toFixed(2)).toBe('295.00');
    expect(await companyCount('inventory_stock_movements')).toBe(movements);
    expect(await companyCount('vouchers')).toBe(vouchers);
    expect(await balance()).toBe('6.0000 @ 600.00');
  });

  it('posts a return at the Branch average cost with a balanced SR voucher', async () => {
    const id = await idByNumber('SR-2025-0001');
    const posted = await new m.SaleReturnPostService(companyId).post(id, userId, allBranches());
    expect(posted).toMatchObject({ status: 'Posted', sale_return_number: 'SR-2025-0001' });

    const voucher = await voucherFor(id);
    expect(voucher.voucherType).toBe('SR');
    expect(voucher.voucherNumber).toBe('SR-2025-0001');
    expect(voucher.totalDebit.toFixed(2)).toBe('515.00');
    expect(voucher.totalCredit.toFixed(2)).toBe('515.00');
    expect(amountOn(voucher, settings.revenue)).toEqual({ debit: '300.00', credit: '0.00' });
    expect(amountOn(voucher, settings.tax)).toEqual({ debit: '10.00', credit: '0.00' });
    expect(amountOn(voucher, settings.freight)).toEqual({ debit: '5.00', credit: '0.00' });
    expect(amountOn(voucher, settings.inventory)).toEqual({ debit: '200.00', credit: '0.00' });
    expect(amountOn(voucher, customerAccountId)).toEqual({ debit: '0.00', credit: '295.00' });
    expect(amountOn(voucher, settings.discount)).toEqual({ debit: '0.00', credit: '20.00' });
    expect(amountOn(voucher, settings.cogs)).toEqual({ debit: '0.00', credit: '200.00' });

    const movements = await prisma.$queryRaw<{ movement_kind: string; branch_id: string | null; warehouse_id: string | null; quantity_in: string; quantity_out: string; total_cost: string }[]>`
      SELECT movement_kind::text, branch_id::text, warehouse_id::text, quantity_in::text, quantity_out::text, total_cost::text
      FROM inventory_stock_movements WHERE company_id = CAST(${companyId} AS uuid) AND source_document_id = CAST(${id} AS uuid)
    `;
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ movement_kind: 'SALES_RETURN', branch_id: branchOne, warehouse_id: null });
    expect(new Decimal(movements[0].quantity_in).toFixed(4)).toBe('2.0000');
    expect(new Decimal(movements[0].quantity_out).isZero()).toBe(true);
    expect(new Decimal(movements[0].total_cost).toFixed(2)).toBe('200.00');

    expect(await balance()).toBe('8.0000 @ 800.00');
    expect(new Decimal((await returnRow(id)).cost_amount).toFixed(2)).toBe('200.00');
  });

  it('refuses to post a posted return again', async () => {
    const id = await idByNumber('SR-2025-0001');
    const movements = await companyCount('inventory_stock_movements');
    await expect(new m.SaleReturnPostService(companyId).post(id, userId, allBranches()))
      .rejects.toMatchObject({ message: 'Only Draft sale returns can be posted.', statusCode: 400 });
    expect(await companyCount('inventory_stock_movements')).toBe(movements);
    expect(await balance()).toBe('8.0000 @ 800.00');
  });

  it('values a return to a Branch with no stock at the item standard cost and creates the balance', async () => {
    expect(await balance(branchTwo)).toBeNull();
    const draft = await createDraft({ sale_return_date: '2025-08-03', branch_id: branchTwo });
    await new m.SaleReturnPostService(companyId).post(draft.id, userId);
    expect(await balance(branchTwo)).toBe('1.0000 @ 95.00');
    const voucher = await voucherFor(draft.id);
    expect(amountOn(voucher, settings.inventory)).toEqual({ debit: '95.00', credit: '0.00' });
    expect(amountOn(voucher, settings.cogs)).toEqual({ debit: '0.00', credit: '95.00' });
  });

  it('credits the default cash account for a cash refund', async () => {
    const draft = await createDraft({ sale_return_date: '2025-08-04', payment_type: 'Cash' });
    await new m.SaleReturnPostService(companyId).post(draft.id, userId);
    const voucher = await voucherFor(draft.id);
    expect(amountOn(voucher, settings.cash)).toEqual({ debit: '0.00', credit: '150.00' });
    expect(amountOn(voucher, customerAccountId)).toEqual({ debit: '0.00', credit: '0.00' });
    expect(await balance()).toBe('9.0000 @ 900.00');
  });

  it('reports validation errors and saves nothing', async () => {
    const validator = new m.SaleReturnValidationService(companyId);
    const errorsFor = async (overrides: Partial<ReturnInput>) => (await validator.validate(returnInput(overrides))).errors.join(' | ');
    expect(await errorsFor({ lines: [{ item_id: itemA, quantity: 1, sale_price: 10, discount_amount: 10.5, tax_amount: 0 }] }))
      .toMatch(/Discount cannot be more than the item amount on line 1/);
    expect(await errorsFor({ customer_return_date: '2025-08-05' })).toMatch(/Customer Return Date cannot be after Sale Return Date/);
    expect(await errorsFor({ customer_return_number: 'cr-1' })).toMatch(/Customer Return No\. is already used on SR-2025-0001/);
    expect(await errorsFor({ branch_id: undefined })).toMatch(/Please select a Branch or Warehouse/);
    expect(await errorsFor({ sale_return_date: '2026-07-01' })).toMatch(/Date is not in any active Fiscal Year/);
    expect(m.ValidateSaleReturnInput.safeParse({ ...returnInput(), lines: [] }).success).toBe(false);
    expect(m.ValidateSaleReturnInput.safeParse({ ...returnInput(), lines: [{ item_id: itemA, quantity: 0, sale_price: 10 }] }).success).toBe(false);

    const before = await companyCount('sale_returns');
    await expect(createDraft({ customer_return_number: 'CR-1' })).rejects.toMatchObject({ statusCode: 400 });
    expect(await companyCount('sale_returns')).toBe(before);
  });

  it('lets Branch users post returns only for their own Branch and blocks Warehouse users', async () => {
    const { resolveSellingBranchId } = m.access;
    expect(() => resolveSellingBranchId(warehouseUser(), branchOne, 'Sale Return')).toThrow(/Warehouse users cannot create a Sale Return/);
    expect(() => resolveSellingBranchId(branchUser(branchTwo), branchOne, 'Sale Return')).toThrow(/only create a Sale Return for your own Branch/);
    expect(resolveSellingBranchId(branchUser(branchTwo), undefined, 'Sale Return')).toBe(branchTwo);

    const id = await idByNumber('SR-2025-0002');
    await expect(new m.SaleReturnPostService(companyId).post(id, userId, branchUser(branchTwo)))
      .rejects.toMatchObject({ message: 'You can only post Sale Returns for your own Branch.', statusCode: 403 });
    await expect(new m.SaleReturnPostService(companyId).post(id, userId, warehouseUser())).rejects.toMatchObject({ statusCode: 403 });
    expect((await returnRow(id)).status).toBe('Draft');
    await expect(new m.SaleReturnDetailService(companyId, branchUser(branchTwo)).getById(id)).rejects.toMatchObject({ statusCode: 404 });

    await new m.SaleReturnPostService(companyId).post(id, userId, branchUser(branchOne));
    expect(await balance()).toBe('10.0000 @ 1000.00');

    const branchTwoList = await new m.SaleReturnListService(companyId, branchUser(branchTwo)).list(m.ListSaleReturnsQuery.parse({}));
    expect(branchTwoList.total).toBe(1);
    expect(new Decimal(branchTwoList.totals.net_amount).toFixed(2)).toBe('150.00');
  });

  it('returns grand totals for every matching return, not only the current page', async () => {
    const service = new m.SaleReturnListService(companyId, allBranches());
    const page = await service.list(m.ListSaleReturnsQuery.parse({ limit: 1 }));
    expect(page.data).toHaveLength(1);
    // SR-0001 295.00, SR-0002 150.00, Shop Two 150.00, cash refund 150.00.
    expect(page.total).toBe(4);
    expect(new Decimal(page.totals.net_amount).toFixed(2)).toBe('745.00');
    expect(new Decimal(page.totals.gross_amount).toFixed(2)).toBe('750.00');
    expect(new Decimal(page.totals.discount_amount).toFixed(2)).toBe('20.00');
    expect(new Decimal(page.totals.tax_amount).toFixed(2)).toBe('10.00');
    expect(new Decimal(page.totals.freight_amount).toFixed(2)).toBe('5.00');

    const branchFilter = await service.list(m.ListSaleReturnsQuery.parse({ branch_id: branchTwo }));
    expect(branchFilter.total).toBe(1);
  });

  it('rejects posting a return into a locked period', async () => {
    const draft = await createDraft({ sale_return_date: '2026-01-10' });
    expect(draft.sale_return_number).toBe('SR-2026-0001');
    const fiscalYears = new m.FiscalYearService(companyId);
    const january = (await fiscalYears.getPeriods(fiscalYearId)).find(period => period.start_date === '2026-01-01');
    await fiscalYears.lockPeriod(january!.id);

    await expect(new m.SaleReturnPostService(companyId).post(draft.id, userId)).rejects.toThrow(/Period "January 2026" is closed/);
    expect((await returnRow(draft.id)).status).toBe('Draft');
    expect(await balance()).toBe('10.0000 @ 1000.00');
    await expect(createDraft({ sale_return_date: '2026-01-11' })).rejects.toThrow(/is closed/);
  });

  /** Makes posting fail after validation has passed, by making the Sales Revenue Account Inactive for the callback. */
  async function withInactiveRevenueAccount(callback: () => Promise<void>) {
    await prisma.account.update({ where: { id: settings.revenue }, data: { isActive: false } });
    try {
      await callback();
    } finally {
      await prisma.account.update({ where: { id: settings.revenue }, data: { isActive: true } });
    }
  }

  describe('Draft lifecycle: save and post together, edit, cancel', () => {
    it('saves and posts in one step, and leaves no draft behind when posting is refused', async () => {
      const service = new m.SaleReturnDraftService(companyId);
      const posted = await service.createAndPost(returnInput({ sale_return_date: '2025-10-01' }), userId, allBranches());
      expect(posted.status).toBe('Posted');
      expect(await balance()).toBe('11.0000 @ 1100.00');

      const returnsBefore = await companyCount('sale_returns');
      const movementsBefore = await companyCount('inventory_stock_movements');
      await withInactiveRevenueAccount(async () => {
        await expect(service.createAndPost(returnInput({ sale_return_date: '2025-10-02' }), userId))
          .rejects.toThrow(/Sales Revenue Account is not set up or is Inactive/);
      });
      expect(await companyCount('sale_returns')).toBe(returnsBefore);
      expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);
    });

    it('edits a draft (same number, new lines), but not a posted, missing or other-Branch return', async () => {
      const service = new m.SaleReturnDraftService(companyId);
      const draft = await createDraft({ sale_return_date: '2025-10-03', customer_return_number: 'RET-EDIT' });
      const updated = await service.updateDraft(draft.id, returnInput({
        sale_return_date: '2025-10-04', customer_return_number: 'ret-edit', lines: [{ item_id: itemA, quantity: 2, sale_price: 140 }],
      }), userId, branchUser(branchOne));
      expect(updated).toEqual({ id: draft.id, sale_return_number: draft.sale_return_number });
      const row = await returnRow(draft.id);
      expect(row.status).toBe('Draft');
      expect(new Decimal(row.cost_amount).toFixed(2)).toBe('200.00');
      expect(await balance()).toBe('11.0000 @ 1100.00');

      await expect(service.updateDraft(draft.id, returnInput({ sale_return_date: '2025-10-04' }), userId, branchUser(branchTwo)))
        .rejects.toMatchObject({ statusCode: 403, message: 'You can only change Sale Returns for your own Branch.' });
      await expect(service.updateDraft('00000000-0000-4000-8000-000000000000', returnInput({ sale_return_date: '2025-10-04' }), userId))
        .rejects.toMatchObject({ statusCode: 404 });
      const posted = await service.createAndPost(returnInput({ sale_return_date: '2025-10-05' }), userId);
      await expect(service.updateDraft(posted.id, returnInput({ sale_return_date: '2025-10-05' }), userId))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Only Draft sale returns can be changed/) });
      await expect(createDraft({ sale_return_date: '2025-10-05', customer_return_number: 'RET-EDIT' }))
        .rejects.toThrow(/Customer Return No\. is already used on/);
    });

    it('saves changes and posts in one step, keeping the old values when posting is refused', async () => {
      const service = new m.SaleReturnDraftService(companyId);
      const draft = await createDraft({ sale_return_date: '2025-10-06' });
      const stockBefore = await balance();
      await withInactiveRevenueAccount(async () => {
        await expect(service.updateAndPost(draft.id, returnInput({ sale_return_date: '2025-10-06', lines: [{ item_id: itemA, quantity: 3, sale_price: 150 }] }), userId))
          .rejects.toThrow(/Sales Revenue Account is not set up or is Inactive/);
      });
      expect((await returnRow(draft.id)).status).toBe('Draft');
      expect(await balance()).toBe(stockBefore);

      const posted = await service.updateAndPost(draft.id, returnInput({ sale_return_date: '2025-10-06', lines: [{ item_id: itemA, quantity: 1, sale_price: 120 }] }), userId, branchUser(branchOne));
      expect(posted).toMatchObject({ id: draft.id, status: 'Posted' });
      expect(amountOn(await voucherFor(draft.id), customerAccountId)).toEqual({ debit: '0.00', credit: '120.00' });
    });

    it('cancels a draft: kept as Voided with the reason; it can no longer be posted, edited or cancelled', async () => {
      const service = new m.SaleReturnDraftService(companyId);
      const draft = await createDraft({ sale_return_date: '2025-10-07' });
      await expect(service.cancelDraft(draft.id, { reason: 'Wrong customer' }, userId, branchUser(branchTwo)))
        .rejects.toMatchObject({ statusCode: 403, message: 'You can only cancel Sale Returns for your own Branch.' });
      expect(await service.cancelDraft(draft.id, { reason: 'Wrong customer' }, userId, branchUser(branchOne)))
        .toEqual({ id: draft.id, sale_return_number: draft.sale_return_number, status: 'Voided' });
      const rows = await prisma.$queryRaw<{ status: string; void_reason: string }[]>`
        SELECT status, void_reason FROM sale_returns WHERE id = CAST(${draft.id} AS uuid)
      `;
      expect(rows[0]).toEqual({ status: 'Voided', void_reason: 'Wrong customer' });
      await expect(new m.SaleReturnPostService(companyId).post(draft.id, userId)).rejects.toThrow(/Only Draft/);
      await expect(service.updateDraft(draft.id, returnInput({ sale_return_date: '2025-10-07' }), userId)).rejects.toThrow(/Only Draft sale returns can be changed/);
      await expect(service.cancelDraft(draft.id, { reason: 'Again' }, userId)).rejects.toThrow(/Only Draft sale returns can be cancelled/);
      const voided = await new m.SaleReturnListService(companyId, allBranches()).list(m.ListSaleReturnsQuery.parse({ status: 'Voided' }));
      expect((voided.data as Array<{ id: string }>).map(row => row.id)).toContain(draft.id);
    });
  });
});
