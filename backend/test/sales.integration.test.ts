/**
 * Sale Voucher document flow against a real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env):
 * validation -> draft -> posting at a Branch, with stock, ledger (revenue and cost of goods sold), numbering,
 * list totals, access scope and closed periods. Everything runs inside a new test company that is deleted afterwards.
 */
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

type AccessScope = import('../src/modules/auth/access-rules.js').AccessScope;
type SaleInput = import('../src/modules/sales/sale-validation.service.js').ValidateSaleInvoiceInput;

describe.skipIf(!databaseUrl)('Sale Vouchers (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let userId = '';

  let m: {
    SaleValidationService: typeof import('../src/modules/sales/sale-validation.service.js')['SaleValidationService'];
    ValidateSaleInvoiceInput: typeof import('../src/modules/sales/sale-validation.service.js')['ValidateSaleInvoiceInput'];
    SaleDraftService: typeof import('../src/modules/sales/sale-draft.service.js')['SaleDraftService'];
    SalePostService: typeof import('../src/modules/sales/sale-post.service.js')['SalePostService'];
    SaleListService: typeof import('../src/modules/sales/sale-list.service.js')['SaleListService'];
    ListSaleInvoicesQuery: typeof import('../src/modules/sales/sale-list.service.js')['ListSaleInvoicesQuery'];
    SaleDetailService: typeof import('../src/modules/sales/sale-detail.service.js')['SaleDetailService'];
    access: typeof import('../src/modules/inventory/stock-holder-access.js');
    FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
  };

  let fiscalYearId = '';
  let settings: { inventory: string; cash: string; revenue: string; tax: string; discount: string; freight: string; cogs: string };
  let customerId = '';
  let customerAccountId = '';
  let otherCustomerId = '';
  let warehouseId = '';
  let branchOne = '';
  let branchTwo = '';
  let itemA = '';
  let itemB = '';

  const allBranches = (): AccessScope => ({ companyId, userId, role: 'admin', accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null });
  const branchUser = (branchId: string): AccessScope => ({ companyId, userId, role: 'sales_staff', accessLevel: 'BRANCH', branchId, warehouseId: null });
  const warehouseUser = (): AccessScope => ({ companyId, userId, role: 'warehouse_staff', accessLevel: 'WAREHOUSE', branchId: null, warehouseId });

  beforeAll(async () => {
    company = await createTestCompany('Sales');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;

    m = {
      SaleValidationService: (await import('../src/modules/sales/sale-validation.service.js')).SaleValidationService,
      ValidateSaleInvoiceInput: (await import('../src/modules/sales/sale-validation.service.js')).ValidateSaleInvoiceInput,
      SaleDraftService: (await import('../src/modules/sales/sale-draft.service.js')).SaleDraftService,
      SalePostService: (await import('../src/modules/sales/sale-post.service.js')).SalePostService,
      SaleListService: (await import('../src/modules/sales/sale-list.service.js')).SaleListService,
      ListSaleInvoicesQuery: (await import('../src/modules/sales/sale-list.service.js')).ListSaleInvoicesQuery,
      SaleDetailService: (await import('../src/modules/sales/sale-detail.service.js')).SaleDetailService,
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

    const supplier = await new SupplierService().create(companyId, supplierInputSchema.parse({ name: 'Sales Test Supplier' }));
    const customers = new CustomerService();
    const customer = await customers.create(companyId, customerInputSchema.parse({ name: 'Sales Test Customer' }));
    customerId = customer.id;
    customerAccountId = String(customer.ar_account_id);
    otherCustomerId = (await customers.create(companyId, customerInputSchema.parse({ name: 'Second Customer' }))).id;

    const branches = new BranchService(companyId);
    branchOne = (await branches.create(createBranchSchema.parse({ code: 'BR-1', name: 'Shop One' }))).id;
    branchTwo = (await branches.create(createBranchSchema.parse({ code: 'BR-2', name: 'Shop Two' }))).id;
    warehouseId = (await new WarehouseService(companyId).create(createWarehouseSchema.parse({ code: 'WH-1', name: 'Main Warehouse' }))).id;

    const products = new ProductService(companyId);
    itemA = (await products.create(createProductSchema.parse({ sku: 'SALE-A', name: 'Sale Item A', product_type: 'Finished' }))).id;
    itemB = (await products.create(createProductSchema.parse({ sku: 'SALE-B', name: 'Sale Item B', product_type: 'Finished', min_sale_price: 50 }))).id;

    // Warehouse buys A 20 @ 100 and B 10 @ 30, then sends A 15 and all of B to Shop One. A 5 stays in the Warehouse.
    const purchase = await new PurchaseDraftService(companyId).createDraft(ValidatePurchaseInvoiceInput.parse({
      purchase_date: '2025-07-10', supplier_id: supplier.id, payment_type: 'Cash', warehouse_id: warehouseId,
      lines: [{ item_id: itemA, quantity: 20, purchase_price: 100 }, { item_id: itemB, quantity: 10, purchase_price: 30 }],
    }), userId);
    await new PurchasePostService(companyId).post(purchase.id, userId);
    await new StockTransferService(companyId).createAndPost(ValidateStockTransferInput.parse({
      transfer_date: '2025-07-11', from_warehouse_id: warehouseId, to_branch_id: branchOne,
      lines: [{ item_id: itemA, quantity: 15 }, { item_id: itemB, quantity: 10 }],
    }), userId);
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  function saleInput(overrides: Partial<SaleInput> = {}): SaleInput {
    return m.ValidateSaleInvoiceInput.parse({
      sale_date: '2025-08-01',
      customer_id: customerId,
      payment_type: 'Credit',
      due_date: '2025-08-31',
      branch_id: branchOne,
      lines: [{ item_id: itemA, quantity: 1, sale_price: 150 }],
      ...overrides,
    });
  }

  const mainSaleLines = () => [
    { item_id: itemA, quantity: 2, sale_price: 250, discount_amount: 50, tax_amount: 45 },
    { item_id: itemB, quantity: 3, sale_price: 60, discount_amount: 0, tax_amount: 0 },
  ];

  async function createDraft(overrides: Partial<SaleInput> = {}) {
    return new m.SaleDraftService(companyId).createDraft(saleInput(overrides), userId);
  }

  async function balance(itemId: string, holder: { branchId?: string; warehouseId?: string } = { branchId: branchOne }) {
    const rows = await prisma.$queryRaw<{ stock_on_hand: string; total_stock_value: string }[]>`
      SELECT stock_on_hand::text, total_stock_value::text
      FROM inventory_stock_balances
      WHERE company_id = CAST(${companyId} AS uuid) AND item_id = CAST(${itemId} AS uuid)
        AND branch_id IS NOT DISTINCT FROM ${holder.branchId ?? null}::uuid
        AND warehouse_id IS NOT DISTINCT FROM ${holder.warehouseId ?? null}::uuid
    `;
    return rows[0] ? `${new Decimal(rows[0].stock_on_hand).toFixed(4)} @ ${new Decimal(rows[0].total_stock_value).toFixed(2)}` : null;
  }

  async function saleRow(id: string) {
    const rows = await prisma.$queryRaw<{ status: string; sale_number: string; accounting_voucher_id: string | null; cost_amount: string; net_amount: string; branch_id: string | null; warehouse_id: string | null }[]>`
      SELECT status, sale_number, accounting_voucher_id::text, cost_amount::text, net_amount::text, branch_id::text, warehouse_id::text
      FROM sale_invoices WHERE company_id = CAST(${companyId} AS uuid) AND id = CAST(${id} AS uuid)
    `;
    return rows[0];
  }

  async function voucherFor(id: string) {
    const row = await saleRow(id);
    return prisma.voucher.findUniqueOrThrow({ where: { id: String(row.accounting_voucher_id) }, include: { lines: true } });
  }

  function amountOn(voucher: Awaited<ReturnType<typeof voucherFor>>, accountId: string) {
    const lines = voucher.lines.filter(line => line.accountId === accountId);
    return {
      debit: lines.reduce((sum, line) => sum.plus(line.debitAmount.toString()), new Decimal(0)).toFixed(2),
      credit: lines.reduce((sum, line) => sum.plus(line.creditAmount.toString()), new Decimal(0)).toFixed(2),
    };
  }

  async function companyCount(table: 'inventory_stock_movements' | 'vouchers' | 'sale_invoices') {
    const rows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM ${table} WHERE company_id = CAST($1 AS uuid)`, companyId,
    );
    return rows[0].total;
  }

  async function idByNumber(saleNumber: string) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text FROM sale_invoices WHERE company_id = CAST(${companyId} AS uuid) AND sale_number = ${saleNumber}
    `;
    return rows[0].id;
  }

  it('links new customers to an account in the 0103 customer range', async () => {
    const account = await prisma.account.findUniqueOrThrow({ where: { id: customerAccountId } });
    expect(account.code).toMatch(/^0103\d{6}$/);
    expect(account.code >= '0103010001' && account.code <= '0103999999').toBe(true);
  });

  it('calculates gross, discount, tax, freight and net amounts', async () => {
    const result = await new m.SaleValidationService(companyId).validate(saleInput({ freight_amount: 20, lines: mainSaleLines() }));
    expect(result.errors).toEqual([]);
    expect(result.totals).toEqual({
      gross_amount: '680.00', discount_amount: '50.00', tax_amount: '45.00', freight_amount: '20.00', net_amount: '695.00',
    });
    expect(result.lines.map(line => line.line_total)).toEqual(['495.00', '180.00']);
    expect(result.branch_id).toBe(branchOne);
  });

  it('checks stock of the selected Branch only', async () => {
    const validator = new m.SaleValidationService(companyId);
    const tooMuch = await validator.validate(saleInput({ lines: [{ item_id: itemA, quantity: 16, sale_price: 150, discount_amount: 0, tax_amount: 0 }] }));
    expect(tooMuch.errors).toContain('Stock is not enough for SALE-A - Sale Item A.');

    // Two lines of the same item are added together.
    const split = await validator.validate(saleInput({
      lines: [
        { item_id: itemA, quantity: 8, sale_price: 150, discount_amount: 0, tax_amount: 0 },
        { item_id: itemA, quantity: 8, sale_price: 150, discount_amount: 0, tax_amount: 0 },
      ],
    }));
    expect(split.errors).toContain('Stock is not enough for SALE-A - Sale Item A.');

    // Shop Two has no stock; the 5 units left in the Warehouse cannot be sold from a Branch.
    const otherBranch = await validator.validate(saleInput({ branch_id: branchTwo }));
    expect(otherBranch.errors).toContain('Stock is not enough for SALE-A - Sale Item A.');

    expect((await validator.validate(saleInput({ lines: [{ item_id: itemA, quantity: 15, sale_price: 150, discount_amount: 0, tax_amount: 0 }] }))).valid).toBe(true);
  });

  it('saves a draft numbered SI-YYYY-NNNN with the Branch average cost and no stock or ledger change', async () => {
    const movements = await companyCount('inventory_stock_movements');
    const vouchers = await companyCount('vouchers');

    const first = await createDraft({ freight_amount: 20, customer_reference_number: 'PO-77', lines: mainSaleLines() });
    const second = await createDraft({ sale_date: '2025-08-02' });
    const nextYear = await createDraft({ sale_date: '2026-02-01', due_date: '2026-03-01' });
    expect(first.sale_number).toBe('SI-2025-0001');
    expect(second.sale_number).toBe('SI-2025-0002');
    expect(nextYear.sale_number).toBe('SI-2026-0001');

    const row = await saleRow(first.id);
    expect(row).toMatchObject({ status: 'Draft', accounting_voucher_id: null, branch_id: branchOne, warehouse_id: null });
    expect(new Decimal(row.cost_amount).toFixed(2)).toBe('290.00');
    expect(new Decimal(row.net_amount).toFixed(2)).toBe('695.00');

    expect(await companyCount('inventory_stock_movements')).toBe(movements);
    expect(await companyCount('vouchers')).toBe(vouchers);
    expect(await balance(itemA)).toBe('15.0000 @ 1500.00');
  });

  it('posts a credit sale: balanced SI voucher with revenue and cost of goods sold, Branch stock reduced', async () => {
    const id = await idByNumber('SI-2025-0001');
    const posted = await new m.SalePostService(companyId).post(id, userId, allBranches());
    expect(posted).toMatchObject({ status: 'Posted', sale_number: 'SI-2025-0001' });

    const voucher = await voucherFor(id);
    expect(voucher.voucherType).toBe('SI');
    expect(voucher.voucherNumber).toBe('SI-2025-0001');
    expect(voucher.totalDebit.toFixed(2)).toBe('1035.00');
    expect(voucher.totalCredit.toFixed(2)).toBe('1035.00');
    expect(amountOn(voucher, customerAccountId)).toEqual({ debit: '695.00', credit: '0.00' });
    expect(amountOn(voucher, settings.discount)).toEqual({ debit: '50.00', credit: '0.00' });
    expect(amountOn(voucher, settings.revenue)).toEqual({ debit: '0.00', credit: '680.00' });
    expect(amountOn(voucher, settings.tax)).toEqual({ debit: '0.00', credit: '45.00' });
    expect(amountOn(voucher, settings.freight)).toEqual({ debit: '0.00', credit: '20.00' });
    expect(amountOn(voucher, settings.cogs)).toEqual({ debit: '290.00', credit: '0.00' });
    expect(amountOn(voucher, settings.inventory)).toEqual({ debit: '0.00', credit: '290.00' });

    const movements = await prisma.$queryRaw<{ item_id: string; movement_kind: string; branch_id: string | null; warehouse_id: string | null; quantity_out: string; total_cost: string }[]>`
      SELECT item_id::text, movement_kind::text, branch_id::text, warehouse_id::text, quantity_out::text, total_cost::text
      FROM inventory_stock_movements WHERE company_id = CAST(${companyId} AS uuid) AND source_document_id = CAST(${id} AS uuid)
    `;
    expect(movements).toHaveLength(2);
    for (const movement of movements) {
      expect(movement).toMatchObject({ movement_kind: 'SALES_DELIVERY', branch_id: branchOne, warehouse_id: null });
    }
    const a = movements.find(row => row.item_id === itemA)!;
    expect(new Decimal(a.quantity_out).toFixed(4)).toBe('2.0000');
    expect(new Decimal(a.total_cost).toFixed(2)).toBe('200.00');

    expect(await balance(itemA)).toBe('13.0000 @ 1300.00');
    expect(await balance(itemB)).toBe('7.0000 @ 210.00');
    expect(await balance(itemA, { warehouseId })).toBe('5.0000 @ 500.00');
    expect(new Decimal((await saleRow(id)).cost_amount).toFixed(2)).toBe('290.00');

    const detail = await new m.SaleDetailService(companyId, allBranches()).getById(id);
    expect(detail.accounting_voucher_number).toBe('SI-2025-0001');
    expect(detail.lines.map((line: { cost_amount: string }) => new Decimal(line.cost_amount).toFixed(2))).toEqual(['200.00', '90.00']);
  });

  it('refuses to post a posted sale again', async () => {
    const id = await idByNumber('SI-2025-0001');
    const movements = await companyCount('inventory_stock_movements');
    await expect(new m.SalePostService(companyId).post(id, userId, allBranches()))
      .rejects.toMatchObject({ message: 'Only Draft sale vouchers can be posted.', statusCode: 400 });
    expect(await companyCount('inventory_stock_movements')).toBe(movements);
    expect(await balance(itemA)).toBe('13.0000 @ 1300.00');
  });

  it('debits the default cash account for a cash sale', async () => {
    const draft = await createDraft({ sale_date: '2025-08-03', payment_type: 'Cash', due_date: undefined, lines: [{ item_id: itemA, quantity: 1, sale_price: 180, discount_amount: 0, tax_amount: 0 }] });
    await new m.SalePostService(companyId).post(draft.id, userId);
    const voucher = await voucherFor(draft.id);
    expect(amountOn(voucher, settings.cash)).toEqual({ debit: '180.00', credit: '0.00' });
    expect(amountOn(voucher, customerAccountId)).toEqual({ debit: '0.00', credit: '0.00' });
    expect(amountOn(voucher, settings.cogs)).toEqual({ debit: '100.00', credit: '0.00' });
    expect(await balance(itemA)).toBe('12.0000 @ 1200.00');
  });

  it('reports validation errors and saves nothing', async () => {
    const validator = new m.SaleValidationService(companyId);
    const errorsFor = async (overrides: Partial<SaleInput>) => (await validator.validate(saleInput(overrides))).errors.join(' | ');

    expect(await errorsFor({ lines: [{ item_id: itemB, quantity: 1, sale_price: 49.99, discount_amount: 0, tax_amount: 0 }] }))
      .toMatch(/Sale Price is below Minimum Sale Price on line 1/);
    expect(await errorsFor({ lines: [{ item_id: itemA, quantity: 1, sale_price: 100, discount_amount: 100.01, tax_amount: 0 }] }))
      .toMatch(/Discount cannot be more than the item amount on line 1/);
    expect(await errorsFor({ due_date: undefined })).toMatch(/Due Date is required for Credit sale/);
    expect(await errorsFor({ due_date: '2025-07-31' })).toMatch(/Due Date cannot be before Sale Date/);
    expect(await errorsFor({ delivery_date: '2025-07-31' })).toMatch(/Delivery Date cannot be before Sale Date/);
    expect(await errorsFor({ customer_reference_number: 'po-77' })).toMatch(/Customer Reference No\. is already used on SI-2025-0001/);
    expect(await errorsFor({ customer_id: otherCustomerId, customer_reference_number: 'PO-77' })).toBe('');
    expect(await errorsFor({ branch_id: undefined })).toMatch(/Please select a Branch or Warehouse/);
    expect(await errorsFor({ sale_date: '2024-12-01', due_date: '2024-12-31' })).toMatch(/Date is not in any active Fiscal Year/);
    expect(await errorsFor({ customer_id: '00000000-0000-4000-8000-000000000000' })).toMatch(/Customer was not found or is inactive/);

    expect(m.ValidateSaleInvoiceInput.safeParse({ ...saleInput(), lines: [] }).success).toBe(false);
    expect(JSON.stringify(m.ValidateSaleInvoiceInput.safeParse({ ...saleInput(), lines: [{ item_id: itemA, quantity: 0, sale_price: 10 }] }).error?.issues))
      .toMatch(/Quantity must be greater than zero/);

    const before = await companyCount('sale_invoices');
    await expect(createDraft({ lines: [{ item_id: itemB, quantity: 1, sale_price: 10, discount_amount: 0, tax_amount: 0 }] })).rejects.toMatchObject({ statusCode: 400 });
    expect(await companyCount('sale_invoices')).toBe(before);
  });

  it('checks stock again at posting time and rolls back the whole sale', async () => {
    const first = await createDraft({ sale_date: '2025-08-04', lines: [{ item_id: itemA, quantity: 8, sale_price: 150, discount_amount: 0, tax_amount: 0 }] });
    const second = await createDraft({
      sale_date: '2025-08-04',
      lines: [
        { item_id: itemB, quantity: 1, sale_price: 60, discount_amount: 0, tax_amount: 0 },
        { item_id: itemA, quantity: 8, sale_price: 150, discount_amount: 0, tax_amount: 0 },
      ],
    });
    await new m.SalePostService(companyId).post(first.id, userId);
    const movements = await companyCount('inventory_stock_movements');
    const vouchers = await companyCount('vouchers');

    await expect(new m.SalePostService(companyId).post(second.id, userId)).rejects.toThrow(/Stock is not enough for one or more sale items/);
    expect((await saleRow(second.id)).status).toBe('Draft');
    expect(await companyCount('inventory_stock_movements')).toBe(movements);
    expect(await companyCount('vouchers')).toBe(vouchers);
    expect(await balance(itemA)).toBe('4.0000 @ 400.00');
    expect(await balance(itemB)).toBe('7.0000 @ 210.00');
  });

  it('lets Branch users sell and post only for their own Branch and blocks Warehouse users', async () => {
    const { resolveSellingBranchId } = m.access;
    expect(resolveSellingBranchId(branchUser(branchOne), undefined, 'Sale Voucher')).toBe(branchOne);
    expect(resolveSellingBranchId(branchUser(branchOne), branchOne, 'Sale Voucher')).toBe(branchOne);
    expect(() => resolveSellingBranchId(branchUser(branchOne), branchTwo, 'Sale Voucher')).toThrow(/only create a Sale Voucher for your own Branch/);
    expect(() => resolveSellingBranchId(warehouseUser(), branchOne, 'Sale Voucher')).toThrow(/Warehouse users cannot create a Sale Voucher/);
    expect(() => resolveSellingBranchId(allBranches(), undefined, 'Sale Voucher')).toThrow(/Please select a Branch/);
    expect(resolveSellingBranchId(allBranches(), branchTwo, 'Sale Voucher')).toBe(branchTwo);

    const draft = await createDraft({ sale_date: '2025-08-05', lines: [{ item_id: itemA, quantity: 1, sale_price: 150, discount_amount: 0, tax_amount: 0 }] });
    await expect(new m.SalePostService(companyId).post(draft.id, userId, branchUser(branchTwo)))
      .rejects.toMatchObject({ message: 'You can only post Sale Vouchers for your own Branch.', statusCode: 403 });
    await expect(new m.SalePostService(companyId).post(draft.id, userId, warehouseUser()))
      .rejects.toMatchObject({ statusCode: 403 });
    expect((await saleRow(draft.id)).status).toBe('Draft');
    expect(await balance(itemA)).toBe('4.0000 @ 400.00');

    await expect(new m.SaleDetailService(companyId, branchUser(branchTwo)).getById(draft.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(new m.SaleDetailService(companyId, branchUser(branchOne)).getById(draft.id)).resolves.toMatchObject({ id: draft.id });

    await new m.SalePostService(companyId).post(draft.id, userId, branchUser(branchOne));
    expect(await balance(itemA)).toBe('3.0000 @ 300.00');

    const ownList = await new m.SaleListService(companyId, branchUser(branchOne)).list(m.ListSaleInvoicesQuery.parse({}));
    expect(ownList.total).toBe(await companyCount('sale_invoices'));
    const otherList = await new m.SaleListService(companyId, branchUser(branchTwo)).list(m.ListSaleInvoicesQuery.parse({}));
    expect(otherList.total).toBe(0);
    expect(new Decimal(otherList.totals.net_amount).isZero()).toBe(true);
  });

  it('returns grand totals for every matching sale, not only the current page', async () => {
    const service = new m.SaleListService(companyId, allBranches());
    const expected = await prisma.$queryRaw<{ net: string; gross: string; total: number }[]>`
      SELECT SUM(net_amount)::text AS net, SUM(gross_amount)::text AS gross, COUNT(*)::int AS total
      FROM sale_invoices WHERE company_id = CAST(${companyId} AS uuid)
    `;
    const page = await service.list(m.ListSaleInvoicesQuery.parse({ limit: 2 }));
    expect(page.data).toHaveLength(2);
    expect(page.total).toBe(expected[0].total);
    expect(new Decimal(page.totals.net_amount).toFixed(2)).toBe(new Decimal(expected[0].net).toFixed(2));
    expect(new Decimal(page.totals.gross_amount).toFixed(2)).toBe(new Decimal(expected[0].gross).toFixed(2));
    expect(new Decimal(page.totals.tax_amount).toFixed(2)).toBe('45.00');
    expect(new Decimal(page.totals.freight_amount).toFixed(2)).toBe('20.00');

    const cash = await service.list(m.ListSaleInvoicesQuery.parse({ payment_type: 'Cash' }));
    expect(cash.total).toBe(1);
    expect(new Decimal(cash.totals.net_amount).toFixed(2)).toBe('180.00');

    const posted = await service.list(m.ListSaleInvoicesQuery.parse({ status: 'Posted', date_from: '2025-08-01', date_to: '2025-08-31' }));
    // SI-0001 695.00, cash 180.00, 8 units 1200.00, Branch user sale 150.00.
    expect(posted.total).toBe(4);
    expect(new Decimal(posted.totals.net_amount).toFixed(2)).toBe('2225.00');
  });

  it('rejects posting a sale into a locked period', async () => {
    const draft = await createDraft({ sale_date: '2025-12-02', due_date: '2025-12-31' });
    const fiscalYears = new m.FiscalYearService(companyId);
    const december = (await fiscalYears.getPeriods(fiscalYearId)).find(period => period.start_date === '2025-12-01');
    await fiscalYears.lockPeriod(december!.id);

    await expect(new m.SalePostService(companyId).post(draft.id, userId)).rejects.toThrow(/Sale Date cannot be used\. Period "December 2025" is closed/);
    expect((await saleRow(draft.id)).status).toBe('Draft');
    expect(await balance(itemA)).toBe('3.0000 @ 300.00');
    await expect(createDraft({ sale_date: '2025-12-03', due_date: '2025-12-31' })).rejects.toThrow(/is closed/);
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

  const oneItemB = (price = 60) => [{ item_id: itemB, quantity: 1, sale_price: price, discount_amount: 0, tax_amount: 0 }];

  describe('Draft lifecycle: save and post together, edit, cancel', () => {
    it('saves and posts in one step', async () => {
      const posted = await new m.SaleDraftService(companyId).createAndPost(saleInput({ sale_date: '2025-10-01', due_date: '2025-10-31', lines: oneItemB() }), userId, allBranches());
      expect(posted.status).toBe('Posted');
      expect((await saleRow(posted.id)).status).toBe('Posted');
      expect(await balance(itemB)).toBe('6.0000 @ 180.00');
    });

    it('leaves no draft behind when Save And Post is refused at posting', async () => {
      const salesBefore = await companyCount('sale_invoices');
      const movementsBefore = await companyCount('inventory_stock_movements');
      await withInactiveRevenueAccount(async () => {
        await expect(new m.SaleDraftService(companyId).createAndPost(saleInput({ sale_date: '2025-10-02', due_date: '2025-10-31', lines: oneItemB() }), userId))
          .rejects.toThrow(/Sales Revenue Account is not set up or is Inactive/);
      });
      expect(await companyCount('sale_invoices')).toBe(salesBefore);
      expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);
      expect(await balance(itemB)).toBe('6.0000 @ 180.00');
    });

    it('edits a draft: same number, new lines and cost, stock and ledger untouched', async () => {
      const draft = await createDraft({ sale_date: '2025-10-03', due_date: '2025-10-31', customer_reference_number: 'CUST-EDIT' });
      const vouchersBefore = await companyCount('vouchers');
      const updated = await new m.SaleDraftService(companyId).updateDraft(draft.id, saleInput({
        sale_date: '2025-10-04', due_date: '2025-11-03', customer_reference_number: 'cust-edit', lines: [{ item_id: itemB, quantity: 2, sale_price: 70, discount_amount: 0, tax_amount: 0 }],
      }), userId, allBranches());
      expect(updated).toEqual({ id: draft.id, sale_number: draft.sale_number });
      const row = await saleRow(draft.id);
      expect(row.status).toBe('Draft');
      expect(new Decimal(row.net_amount).toFixed(2)).toBe('140.00');
      // Cost is 2 x the Branch average of item B (30.00).
      expect(new Decimal(row.cost_amount).toFixed(2)).toBe('60.00');
      expect(await companyCount('vouchers')).toBe(vouchersBefore);
      expect(await balance(itemB)).toBe('6.0000 @ 180.00');

      // Another sale still cannot use the same Customer Reference No.
      await expect(createDraft({ sale_date: '2025-10-04', due_date: '2025-10-31', customer_reference_number: 'CUST-EDIT' }))
        .rejects.toThrow(/Customer Reference No\. is already used on/);
    });

    it('refuses to edit a posted or missing sale, and a draft of another Branch', async () => {
      const service = new m.SaleDraftService(companyId);
      const posted = await service.createAndPost(saleInput({ sale_date: '2025-10-05', due_date: '2025-10-31', lines: oneItemB() }), userId);
      await expect(service.updateDraft(posted.id, saleInput({ sale_date: '2025-10-05', due_date: '2025-10-31' }), userId))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Only Draft sale vouchers can be changed/) });
      await expect(service.updateDraft('00000000-0000-4000-8000-000000000000', saleInput({ sale_date: '2025-10-05', due_date: '2025-10-31' }), userId))
        .rejects.toMatchObject({ statusCode: 404 });

      const draft = await createDraft({ sale_date: '2025-10-05', due_date: '2025-10-31' });
      await expect(service.updateDraft(draft.id, saleInput({ sale_date: '2025-10-05', due_date: '2025-10-31' }), userId, branchUser(branchTwo)))
        .rejects.toMatchObject({ statusCode: 403, message: 'You can only change Sale Vouchers for your own Branch.' });
      await expect(service.cancelDraft(draft.id, { reason: 'Not mine' }, userId, branchUser(branchTwo)))
        .rejects.toMatchObject({ statusCode: 403, message: 'You can only cancel Sale Vouchers for your own Branch.' });
      expect((await saleRow(draft.id)).status).toBe('Draft');
    });

    it('saves changes and posts a draft in one step, and keeps the old values when posting is refused', async () => {
      const service = new m.SaleDraftService(companyId);
      const refused = await createDraft({ sale_date: '2025-10-06', due_date: '2025-10-31', lines: oneItemB() });
      await withInactiveRevenueAccount(async () => {
        await expect(service.updateAndPost(refused.id, saleInput({ sale_date: '2025-10-06', due_date: '2025-10-31', lines: oneItemB(99) }), userId))
          .rejects.toThrow(/Sales Revenue Account is not set up or is Inactive/);
      });
      const kept = await saleRow(refused.id);
      expect(kept.status).toBe('Draft');
      expect(new Decimal(kept.net_amount).toFixed(2)).toBe('60.00');

      const posted = await service.updateAndPost(refused.id, saleInput({ sale_date: '2025-10-06', due_date: '2025-10-31', lines: oneItemB(80) }), userId, branchUser(branchOne));
      expect(posted).toMatchObject({ id: refused.id, status: 'Posted' });
      expect(amountOn(await voucherFor(refused.id), customerAccountId)).toEqual({ debit: '80.00', credit: '0.00' });
    });

    it('cancels a draft: kept as Voided with the reason; it can no longer be posted, edited or cancelled', async () => {
      const service = new m.SaleDraftService(companyId);
      const draft = await createDraft({ sale_date: '2025-10-07', due_date: '2025-10-31' });
      expect(await service.cancelDraft(draft.id, { reason: 'Customer changed mind' }, userId, branchUser(branchOne)))
        .toEqual({ id: draft.id, sale_number: draft.sale_number, status: 'Voided' });
      const rows = await prisma.$queryRaw<{ status: string; void_reason: string; voided_at: Date | null }[]>`
        SELECT status, void_reason, voided_at FROM sale_invoices WHERE id = CAST(${draft.id} AS uuid)
      `;
      expect(rows[0]).toMatchObject({ status: 'Voided', void_reason: 'Customer changed mind' });
      expect(rows[0].voided_at).not.toBeNull();

      await expect(new m.SalePostService(companyId).post(draft.id, userId)).rejects.toThrow(/Only Draft sale vouchers can be posted/);
      await expect(service.updateDraft(draft.id, saleInput({ sale_date: '2025-10-07', due_date: '2025-10-31' }), userId)).rejects.toThrow(/Only Draft sale vouchers can be changed/);
      await expect(service.cancelDraft(draft.id, { reason: 'Again' }, userId)).rejects.toThrow(/Only Draft sale vouchers can be cancelled/);

      const voided = await new m.SaleListService(companyId, allBranches()).list(m.ListSaleInvoicesQuery.parse({ status: 'Voided' }));
      expect((voided.data as Array<{ id: string }>).map(row => row.id)).toContain(draft.id);
    });
  });
});
