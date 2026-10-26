/**
 * Purchase Return document flow against a real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env):
 * validation -> draft -> posting, with stock, ledger, numbering, list totals, access scope and closed periods.
 * Everything runs inside a new test company that is deleted afterwards.
 */
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

type AccessScope = import('../src/modules/auth/access-rules.js').AccessScope;
type ReturnInput = import('../src/modules/purchase-returns/purchase-return-validation.service.js').ValidatePurchaseReturnInput;

describe.skipIf(!databaseUrl)('Purchase Returns (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let userId = '';

  let m: {
    PurchaseReturnValidationService: typeof import('../src/modules/purchase-returns/purchase-return-validation.service.js')['PurchaseReturnValidationService'];
    ValidatePurchaseReturnInput: typeof import('../src/modules/purchase-returns/purchase-return-validation.service.js')['ValidatePurchaseReturnInput'];
    PurchaseReturnDraftService: typeof import('../src/modules/purchase-returns/purchase-return-draft.service.js')['PurchaseReturnDraftService'];
    PurchaseReturnPostService: typeof import('../src/modules/purchase-returns/purchase-return-post.service.js')['PurchaseReturnPostService'];
    PurchaseReturnListService: typeof import('../src/modules/purchase-returns/purchase-return-list.service.js')['PurchaseReturnListService'];
    ListPurchaseReturnsQuery: typeof import('../src/modules/purchase-returns/purchase-return-list.service.js')['ListPurchaseReturnsQuery'];
    PurchaseReturnDetailService: typeof import('../src/modules/purchase-returns/purchase-return-detail.service.js')['PurchaseReturnDetailService'];
    access: typeof import('../src/modules/inventory/stock-holder-access.js');
    FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
  };

  let fiscalYearId = '';
  let settings: { inventory: string; cash: string; tax: string; freight: string; discount: string };
  let supplierId = '';
  let supplierAccountId = '';
  let warehouseId = '';
  let otherWarehouseId = '';
  let branchId = '';
  let itemA = '';
  let itemB = '';

  const allBranches = (): AccessScope => ({ companyId, userId, role: 'admin', accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null });
  const branchUser = (): AccessScope => ({ companyId, userId, role: 'sales_staff', accessLevel: 'BRANCH', branchId, warehouseId: null });
  const warehouseUser = (id: string): AccessScope => ({ companyId, userId, role: 'warehouse_staff', accessLevel: 'WAREHOUSE', branchId: null, warehouseId: id });

  beforeAll(async () => {
    company = await createTestCompany('Purchase Returns');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;

    m = {
      PurchaseReturnValidationService: (await import('../src/modules/purchase-returns/purchase-return-validation.service.js')).PurchaseReturnValidationService,
      ValidatePurchaseReturnInput: (await import('../src/modules/purchase-returns/purchase-return-validation.service.js')).ValidatePurchaseReturnInput,
      PurchaseReturnDraftService: (await import('../src/modules/purchase-returns/purchase-return-draft.service.js')).PurchaseReturnDraftService,
      PurchaseReturnPostService: (await import('../src/modules/purchase-returns/purchase-return-post.service.js')).PurchaseReturnPostService,
      PurchaseReturnListService: (await import('../src/modules/purchase-returns/purchase-return-list.service.js')).PurchaseReturnListService,
      ListPurchaseReturnsQuery: (await import('../src/modules/purchase-returns/purchase-return-list.service.js')).ListPurchaseReturnsQuery,
      PurchaseReturnDetailService: (await import('../src/modules/purchase-returns/purchase-return-detail.service.js')).PurchaseReturnDetailService,
      access: await import('../src/modules/inventory/stock-holder-access.js'),
      FiscalYearService: (await import('../src/modules/fiscal-years/fiscal-year.service.js')).FiscalYearService,
    };
    const { PostingAccountSettingsService } = await import('../src/modules/settings/posting-account-settings.service.js');
    const { SupplierService } = await import('../src/modules/parties/supplier.service.js');
    const { supplierInputSchema } = await import('../src/modules/parties/party.schema.js');
    const { WarehouseService } = await import('../src/modules/inventory/warehouse.service.js');
    const { createWarehouseSchema } = await import('../src/modules/inventory/warehouse.schema.js');
    const { BranchService } = await import('../src/modules/branches/branch.service.js');
    const { createBranchSchema } = await import('../src/modules/branches/branch.schema.js');
    const { ProductService } = await import('../src/modules/inventory/product.service.js');
    const { createProductSchema } = await import('../src/modules/inventory/product.schema.js');
    const { PurchaseDraftService } = await import('../src/modules/purchases/purchase-draft.service.js');
    const { PurchasePostService } = await import('../src/modules/purchases/purchase-post.service.js');
    const { ValidatePurchaseInvoiceInput } = await import('../src/modules/purchases/purchase-validation.service.js');

    const year = await new m.FiscalYearService(companyId).create({
      fiscal_year: '2025-2026', year_basis: 'july', start_date: '2025-07-01', end_date: '2026-06-30',
      number_of_periods: 12, posting_cutoff_days: 0,
    });
    fiscalYearId = year.fiscal_year.id;

    const posting = await new PostingAccountSettingsService(companyId).get();
    settings = {
      inventory: String(posting.purchase?.default_inventory_account_id),
      cash: String(posting.purchase?.default_cash_account_id),
      tax: String(posting.purchase?.purchase_tax_account_id),
      freight: String(posting.purchase?.freight_account_id),
      discount: String(posting.purchase?.purchase_discount_account_id),
    };

    const supplier = await new SupplierService().create(companyId, supplierInputSchema.parse({ name: 'Return Supplier' }));
    supplierId = supplier.id;
    supplierAccountId = String(supplier.ap_account_id);

    branchId = (await new BranchService(companyId).create(createBranchSchema.parse({ code: 'BR-1', name: 'Main Shop' }))).id;
    const warehouses = new WarehouseService(companyId);
    warehouseId = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-1', name: 'Main Warehouse' }))).id;
    otherWarehouseId = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-2', name: 'Second Warehouse' }))).id;

    const products = new ProductService(companyId);
    itemA = (await products.create(createProductSchema.parse({ sku: 'RET-A', name: 'Return Item A', product_type: 'Finished' }))).id;
    itemB = (await products.create(createProductSchema.parse({ sku: 'RET-B', name: 'Return Item B', product_type: 'Finished' }))).id;

    // Stock to return: A 20 @ 100 and B 10 @ 40 in the Main Warehouse, bought through the purchase flow.
    const purchase = await new PurchaseDraftService(companyId).createDraft(ValidatePurchaseInvoiceInput.parse({
      purchase_date: '2025-07-15', supplier_id: supplierId, payment_type: 'Credit', due_date: '2025-08-15', warehouse_id: warehouseId,
      lines: [{ item_id: itemA, quantity: 20, purchase_price: 100 }, { item_id: itemB, quantity: 10, purchase_price: 40 }],
    }), userId);
    await new PurchasePostService(companyId).post(purchase.id, userId);
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  function returnInput(overrides: Partial<ReturnInput> = {}): ReturnInput {
    return m.ValidatePurchaseReturnInput.parse({
      purchase_return_date: '2025-08-01',
      supplier_id: supplierId,
      payment_type: 'Credit',
      warehouse_id: warehouseId,
      lines: [{ item_id: itemA, quantity: 2, purchase_price: 100 }],
      ...overrides,
    });
  }

  async function createDraft(overrides: Partial<ReturnInput> = {}) {
    return new m.PurchaseReturnDraftService(companyId).createDraft(returnInput(overrides), userId);
  }

  async function post(id: string) {
    return new m.PurchaseReturnPostService(companyId).post(id, userId);
  }

  async function balanceOf(itemId: string, warehouse = warehouseId) {
    const rows = await prisma.$queryRaw<{ stock_on_hand: string; total_stock_value: string; average_cost: string }[]>`
      SELECT stock_on_hand::text, total_stock_value::text, average_cost::text
      FROM inventory_stock_balances
      WHERE company_id = CAST(${companyId} AS uuid) AND item_id = CAST(${itemId} AS uuid) AND warehouse_id = CAST(${warehouse} AS uuid)
    `;
    return rows[0] ? {
      quantity: new Decimal(rows[0].stock_on_hand).toFixed(4),
      value: new Decimal(rows[0].total_stock_value).toFixed(2),
      average: new Decimal(rows[0].average_cost).toFixed(4),
    } : null;
  }

  async function returnRow(id: string) {
    const rows = await prisma.$queryRaw<{ status: string; accounting_voucher_id: string | null; net_amount: string }[]>`
      SELECT status, accounting_voucher_id::text, net_amount::text
      FROM purchase_returns WHERE company_id = CAST(${companyId} AS uuid) AND id = CAST(${id} AS uuid)
    `;
    return rows[0];
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

  async function companyCount(table: 'inventory_stock_movements' | 'vouchers' | 'purchase_returns') {
    const rows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM ${table} WHERE company_id = CAST($1 AS uuid)`, companyId,
    );
    return rows[0].total;
  }

  it('calculates gross, discount, tax, freight and net amounts', async () => {
    const result = await new m.PurchaseReturnValidationService(companyId).validate(returnInput({
      freight_amount: 5,
      lines: [
        { item_id: itemA, quantity: 3, purchase_price: 100, discount_amount: 30, tax_amount: 12 },
        { item_id: itemB, quantity: 1, purchase_price: 40, discount_amount: 0, tax_amount: 0 },
      ],
    }));
    expect(result.errors).toEqual([]);
    expect(result.totals).toEqual({
      gross_amount: '340.00', discount_amount: '30.00', tax_amount: '12.00', freight_amount: '5.00', net_amount: '327.00',
    });
    expect(result.lines.map(line => line.line_total)).toEqual(['282.00', '40.00']);
  });

  it('saves a draft numbered PR-YYYY-NNNN without changing stock or the ledger', async () => {
    const movementsBefore = await companyCount('inventory_stock_movements');
    const vouchersBefore = await companyCount('vouchers');

    const first = await createDraft({
      supplier_return_number: 'RTN-1',
      freight_amount: 5,
      lines: [
        { item_id: itemA, quantity: 3, purchase_price: 100, discount_amount: 30, tax_amount: 12 },
        { item_id: itemB, quantity: 1, purchase_price: 40, discount_amount: 0, tax_amount: 0 },
      ],
    });
    const second = await createDraft({ purchase_return_date: '2025-08-02' });
    expect(first.purchase_return_number).toBe('PR-2025-0001');
    expect(second.purchase_return_number).toBe('PR-2025-0002');

    const detail = await new m.PurchaseReturnDetailService(companyId).getById(first.id);
    expect(detail.status).toBe('Draft');
    expect(detail.lines).toHaveLength(2);
    expect(new Decimal(detail.net_amount).toFixed(2)).toBe('327.00');

    expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);
    expect(await companyCount('vouchers')).toBe(vouchersBefore);
    expect(await balanceOf(itemA)).toEqual({ quantity: '20.0000', value: '2000.00', average: '100.0000' });
  });

  it('posts a return: balanced PR voucher, PURCHASE_RETURN movements and lower stock', async () => {
    const { data } = await new m.PurchaseReturnListService(companyId).list(m.ListPurchaseReturnsQuery.parse({ search: 'PR-2025-0001' }));
    const id = (data as Array<{ id: string }>)[0].id;

    const posted = await post(id);
    expect(posted).toMatchObject({ status: 'Posted', purchase_return_number: 'PR-2025-0001' });

    const voucher = await voucherFor(id);
    expect(voucher.voucherType).toBe('PR');
    expect(voucher.voucherNumber).toBe('PR-2025-0001');
    expect(voucher.totalDebit.toFixed(2)).toBe('357.00');
    expect(voucher.totalCredit.toFixed(2)).toBe('357.00');
    expect(amountOn(voucher, supplierAccountId)).toEqual({ debit: '327.00', credit: '0.00' });
    expect(amountOn(voucher, settings.discount)).toEqual({ debit: '30.00', credit: '0.00' });
    expect(amountOn(voucher, settings.inventory)).toEqual({ debit: '0.00', credit: '340.00' });
    expect(amountOn(voucher, settings.tax)).toEqual({ debit: '0.00', credit: '12.00' });
    expect(amountOn(voucher, settings.freight)).toEqual({ debit: '0.00', credit: '5.00' });

    const movements = await prisma.$queryRaw<{ item_id: string; movement_kind: string; quantity_in: string; quantity_out: string; total_cost: string; stock_after_movement: string }[]>`
      SELECT item_id::text, movement_kind::text, quantity_in::text, quantity_out::text, total_cost::text, stock_after_movement::text
      FROM inventory_stock_movements WHERE company_id = CAST(${companyId} AS uuid) AND source_document_id = CAST(${id} AS uuid)
    `;
    expect(movements).toHaveLength(2);
    const a = movements.find(row => row.item_id === itemA)!;
    expect(a.movement_kind).toBe('PURCHASE_RETURN');
    expect(new Decimal(a.quantity_out).toFixed(4)).toBe('3.0000');
    expect(new Decimal(a.quantity_in).isZero()).toBe(true);
    expect(new Decimal(a.total_cost).toFixed(2)).toBe('300.00');
    expect(new Decimal(a.stock_after_movement).toFixed(4)).toBe('17.0000');

    expect(await balanceOf(itemA)).toEqual({ quantity: '17.0000', value: '1700.00', average: '100.0000' });
    expect(await balanceOf(itemB)).toEqual({ quantity: '9.0000', value: '360.00', average: '40.0000' });
  });

  it('refuses to post the same return twice', async () => {
    const { data } = await new m.PurchaseReturnListService(companyId).list(m.ListPurchaseReturnsQuery.parse({ search: 'PR-2025-0001' }));
    const id = (data as Array<{ id: string }>)[0].id;
    const before = await companyCount('inventory_stock_movements');
    await expect(post(id)).rejects.toMatchObject({ message: expect.stringMatching(/Only Draft purchase returns can be posted/), statusCode: 400 });
    expect(await companyCount('inventory_stock_movements')).toBe(before);
    expect(await balanceOf(itemA)).toEqual({ quantity: '17.0000', value: '1700.00', average: '100.0000' });
  });

  it('debits the default cash account for a cash return', async () => {
    const draft = await createDraft({ purchase_return_date: '2025-08-03', payment_type: 'Cash', lines: [{ item_id: itemB, quantity: 1, purchase_price: 40, discount_amount: 0, tax_amount: 0 }] });
    await post(draft.id);
    const voucher = await voucherFor(draft.id);
    expect(amountOn(voucher, settings.cash)).toEqual({ debit: '40.00', credit: '0.00' });
    expect(amountOn(voucher, supplierAccountId)).toEqual({ debit: '0.00', credit: '0.00' });
    expect(await balanceOf(itemB)).toEqual({ quantity: '8.0000', value: '320.00', average: '40.0000' });
  });

  it('does not allow returning more than the Stock On Hand of the Warehouse', async () => {
    const validator = new m.PurchaseReturnValidationService(companyId);
    const tooMuch = await validator.validate(returnInput({ lines: [{ item_id: itemA, quantity: 18, purchase_price: 100, discount_amount: 0, tax_amount: 0 }] }));
    expect(tooMuch.valid).toBe(false);
    expect(tooMuch.errors).toContain('Purchase Return quantity cannot be greater than Stock On Hand.');

    // Two lines of the same item are added together before the check.
    const split = await validator.validate(returnInput({
      lines: [
        { item_id: itemA, quantity: 9, purchase_price: 100, discount_amount: 0, tax_amount: 0 },
        { item_id: itemA, quantity: 9, purchase_price: 100, discount_amount: 0, tax_amount: 0 },
      ],
    }));
    expect(split.errors).toContain('Purchase Return quantity cannot be greater than Stock On Hand.');

    const wrongWarehouse = await validator.validate(returnInput({ warehouse_id: otherWarehouseId }));
    expect(wrongWarehouse.errors).toContain('Purchase Return quantity cannot be greater than Stock On Hand.');

    await expect(createDraft({ lines: [{ item_id: itemA, quantity: 18, purchase_price: 100, discount_amount: 0, tax_amount: 0 }] }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('checks stock again at posting time and rolls back the whole return', async () => {
    // Stock A is 15 after PR-2025-0002 is posted below; two drafts of 9 each pass validation one at a time.
    const { data } = await new m.PurchaseReturnListService(companyId).list(m.ListPurchaseReturnsQuery.parse({ search: 'PR-2025-0002' }));
    await post((data as Array<{ id: string }>)[0].id);
    expect(await balanceOf(itemA)).toEqual({ quantity: '15.0000', value: '1500.00', average: '100.0000' });

    const first = await createDraft({ purchase_return_date: '2025-08-04', lines: [{ item_id: itemA, quantity: 9, purchase_price: 100, discount_amount: 0, tax_amount: 0 }] });
    const second = await createDraft({
      purchase_return_date: '2025-08-04',
      lines: [
        { item_id: itemB, quantity: 1, purchase_price: 40, discount_amount: 0, tax_amount: 0 },
        { item_id: itemA, quantity: 9, purchase_price: 100, discount_amount: 0, tax_amount: 0 },
      ],
    });
    await post(first.id);
    const movementsBefore = await companyCount('inventory_stock_movements');
    const vouchersBefore = await companyCount('vouchers');

    await expect(post(second.id)).rejects.toThrow(/quantity is greater than Stock On Hand/);
    expect((await returnRow(second.id)).status).toBe('Draft');
    expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);
    expect(await companyCount('vouchers')).toBe(vouchersBefore);
    expect(await balanceOf(itemA)).toEqual({ quantity: '6.0000', value: '600.00', average: '100.0000' });
    expect(await balanceOf(itemB)).toEqual({ quantity: '8.0000', value: '320.00', average: '40.0000' });
  });

  it('refuses a return price that would take more value than the stock holds', async () => {
    const draft = await createDraft({ purchase_return_date: '2025-08-05', lines: [{ item_id: itemA, quantity: 6, purchase_price: 150, discount_amount: 0, tax_amount: 0 }] });
    await expect(post(draft.id)).rejects.toThrow(/returned value is greater than the stock value/);
    expect(await balanceOf(itemA)).toEqual({ quantity: '6.0000', value: '600.00', average: '100.0000' });
  });

  it('reports other validation errors', async () => {
    const validator = new m.PurchaseReturnValidationService(companyId);
    const errorsFor = async (overrides: Partial<ReturnInput>) => (await validator.validate(returnInput(overrides))).errors.join(' | ');
    expect(await errorsFor({ lines: [{ item_id: itemA, quantity: 1, purchase_price: 10, discount_amount: 10.01, tax_amount: 0 }] }))
      .toMatch(/Discount cannot be greater than item amount on line 1/);
    expect(await errorsFor({ lines: [{ item_id: itemA, warehouse_id: otherWarehouseId, quantity: 1, purchase_price: 10, discount_amount: 0, tax_amount: 0 }] }))
      .toMatch(/Line 1 Warehouse must match the selected Warehouse/);
    expect(await errorsFor({ supplier_return_date: '2025-08-10' })).toMatch(/Supplier Return Date cannot be after Purchase Return Date/);
    expect(await errorsFor({ supplier_return_number: 'rtn-1' })).toMatch(/Supplier Return No\. is already used on PR-2025-0001/);
    expect(await errorsFor({ purchase_return_date: '2027-01-01' })).toMatch(/does not fall within any active fiscal year/);

    expect(m.ValidatePurchaseReturnInput.safeParse({ ...returnInput(), lines: [] }).success).toBe(false);
    expect(m.ValidatePurchaseReturnInput.safeParse({ ...returnInput(), lines: [{ item_id: itemA, quantity: 0, purchase_price: 10 }] }).success).toBe(false);
  });

  it('returns grand totals across all pages and filters by status', async () => {
    const service = new m.PurchaseReturnListService(companyId);
    const expected = await prisma.$queryRaw<{ net: string; total: number }[]>`
      SELECT SUM(net_amount)::text AS net, COUNT(*)::int AS total FROM purchase_returns WHERE company_id = CAST(${companyId} AS uuid)
    `;
    const page = await service.list(m.ListPurchaseReturnsQuery.parse({ limit: 1 }));
    expect(page.data).toHaveLength(1);
    expect(page.total).toBe(expected[0].total);
    expect(new Decimal(page.totals.net_amount).toFixed(2)).toBe(new Decimal(expected[0].net).toFixed(2));
    expect(new Decimal(page.totals.discount_amount).toFixed(2)).toBe('30.00');

    const posted = await service.list(m.ListPurchaseReturnsQuery.parse({ status: 'Posted' }));
    // PR-0001 327.00, PR-0002 200.00, cash return 40.00 and the 900.00 return of 9 units.
    expect(posted.total).toBe(4);
    expect(new Decimal(posted.totals.net_amount).toFixed(2)).toBe('1467.00');
  });

  it('limits purchase returns to the Warehouse user of that Warehouse and blocks Branch users', async () => {
    const { resolvePurchasingWarehouseId, assertWarehouseDocumentAccess } = m.access;
    expect(() => resolvePurchasingWarehouseId(branchUser(), warehouseId, 'Purchase Return')).toThrow(/Branch users cannot create a Purchase Return/);
    expect(() => resolvePurchasingWarehouseId(warehouseUser(otherWarehouseId), warehouseId, 'Purchase Return')).toThrow(/your own Warehouse/);
    expect(resolvePurchasingWarehouseId(warehouseUser(warehouseId), warehouseId, 'Purchase Return')).toBe(warehouseId);

    const draft = await createDraft({ purchase_return_date: '2025-08-06', lines: [{ item_id: itemB, quantity: 1, purchase_price: 40, discount_amount: 0, tax_amount: 0 }] });
    await expect(assertWarehouseDocumentAccess(allBranches(), 'purchase_returns', draft.id)).resolves.toBeUndefined();
    await expect(assertWarehouseDocumentAccess(warehouseUser(warehouseId), 'purchase_returns', draft.id)).resolves.toBeUndefined();
    await expect(assertWarehouseDocumentAccess(warehouseUser(otherWarehouseId), 'purchase_returns', draft.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(assertWarehouseDocumentAccess(branchUser(), 'purchase_returns', draft.id)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects posting a return into a locked period', async () => {
    const draft = await createDraft({ purchase_return_date: '2025-10-05', lines: [{ item_id: itemB, quantity: 1, purchase_price: 40, discount_amount: 0, tax_amount: 0 }] });
    const fiscalYears = new m.FiscalYearService(companyId);
    const october = (await fiscalYears.getPeriods(fiscalYearId)).find(period => period.start_date === '2025-10-01');
    await fiscalYears.lockPeriod(october!.id);

    await expect(post(draft.id)).rejects.toThrow(/Period "October 2025" is closed/);
    expect((await returnRow(draft.id)).status).toBe('Draft');
    expect(await balanceOf(itemB)).toEqual({ quantity: '8.0000', value: '320.00', average: '40.0000' });
    await expect(createDraft({ purchase_return_date: '2025-10-06' })).rejects.toThrow(/is closed/);
  });
});
