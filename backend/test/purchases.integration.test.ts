/**
 * Purchase Voucher document flow against a real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env):
 * validation -> draft -> posting, with stock, ledger, numbering, list totals, access scope and closed periods.
 * Everything runs inside a new test company that is deleted afterwards.
 */
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

type AccessScope = import('../src/modules/auth/access-rules.js').AccessScope;
type PurchaseInput = import('../src/modules/purchases/purchase-validation.service.js').ValidatePurchaseInvoiceInput;

describe.skipIf(!databaseUrl)('Purchase Vouchers (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let userId = '';

  let m: {
    PurchaseValidationService: typeof import('../src/modules/purchases/purchase-validation.service.js')['PurchaseValidationService'];
    ValidatePurchaseInvoiceInput: typeof import('../src/modules/purchases/purchase-validation.service.js')['ValidatePurchaseInvoiceInput'];
    PurchaseDraftService: typeof import('../src/modules/purchases/purchase-draft.service.js')['PurchaseDraftService'];
    PurchasePostService: typeof import('../src/modules/purchases/purchase-post.service.js')['PurchasePostService'];
    PurchaseListService: typeof import('../src/modules/purchases/purchase-list.service.js')['PurchaseListService'];
    ListPurchaseInvoicesQuery: typeof import('../src/modules/purchases/purchase-list.service.js')['ListPurchaseInvoicesQuery'];
    PurchaseDetailService: typeof import('../src/modules/purchases/purchase-detail.service.js')['PurchaseDetailService'];
    access: typeof import('../src/modules/inventory/stock-holder-access.js');
    FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
  };

  let fiscalYearId = '';
  let settings: { inventory: string; cash: string; tax: string; freight: string; discount: string };
  let supplierId = '';
  let supplierAccountId = '';
  let otherSupplierId = '';
  let warehouseId = '';
  let otherWarehouseId = '';
  let locationWarehouseId = '';
  let defaultLocationId = '';
  let emptyLocationWarehouseId = '';
  let branchId = '';
  let itemA = '';
  let itemB = '';
  let notPurchasableItem = '';

  const allBranches = (): AccessScope => ({ companyId, userId, role: 'admin', accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null });
  const branchUser = (): AccessScope => ({ companyId, userId, role: 'sales_staff', accessLevel: 'BRANCH', branchId, warehouseId: null });
  const warehouseUser = (id: string): AccessScope => ({ companyId, userId, role: 'warehouse_staff', accessLevel: 'WAREHOUSE', branchId: null, warehouseId: id });

  beforeAll(async () => {
    company = await createTestCompany('Purchases');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;

    m = {
      PurchaseValidationService: (await import('../src/modules/purchases/purchase-validation.service.js')).PurchaseValidationService,
      ValidatePurchaseInvoiceInput: (await import('../src/modules/purchases/purchase-validation.service.js')).ValidatePurchaseInvoiceInput,
      PurchaseDraftService: (await import('../src/modules/purchases/purchase-draft.service.js')).PurchaseDraftService,
      PurchasePostService: (await import('../src/modules/purchases/purchase-post.service.js')).PurchasePostService,
      PurchaseListService: (await import('../src/modules/purchases/purchase-list.service.js')).PurchaseListService,
      ListPurchaseInvoicesQuery: (await import('../src/modules/purchases/purchase-list.service.js')).ListPurchaseInvoicesQuery,
      PurchaseDetailService: (await import('../src/modules/purchases/purchase-detail.service.js')).PurchaseDetailService,
      access: await import('../src/modules/inventory/stock-holder-access.js'),
      FiscalYearService: (await import('../src/modules/fiscal-years/fiscal-year.service.js')).FiscalYearService,
    };
    const { PostingAccountSettingsService } = await import('../src/modules/settings/posting-account-settings.service.js');
    const { SupplierService } = await import('../src/modules/parties/supplier.service.js');
    const { supplierInputSchema } = await import('../src/modules/parties/party.schema.js');
    const { WarehouseService } = await import('../src/modules/inventory/warehouse.service.js');
    const { createWarehouseSchema, createWarehouseLocationSchema } = await import('../src/modules/inventory/warehouse.schema.js');
    const { BranchService } = await import('../src/modules/branches/branch.service.js');
    const { createBranchSchema } = await import('../src/modules/branches/branch.schema.js');
    const { ProductService } = await import('../src/modules/inventory/product.service.js');
    const { createProductSchema } = await import('../src/modules/inventory/product.schema.js');

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

    const suppliers = new SupplierService();
    const supplier = await suppliers.create(companyId, supplierInputSchema.parse({ name: 'Test Supplier One' }));
    supplierId = supplier.id;
    supplierAccountId = String(supplier.ap_account_id);
    otherSupplierId = (await suppliers.create(companyId, supplierInputSchema.parse({ name: 'Test Supplier Two' }))).id;

    branchId = (await new BranchService(companyId).create(createBranchSchema.parse({ code: 'BR-1', name: 'Main Shop' }))).id;
    const warehouses = new WarehouseService(companyId);
    warehouseId = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-1', name: 'Main Warehouse' }))).id;
    otherWarehouseId = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-2', name: 'Second Warehouse' }))).id;
    locationWarehouseId = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-L', name: 'Shelf Warehouse', use_locations: true }))).id;
    defaultLocationId = (await warehouses.createLocation(locationWarehouseId, createWarehouseLocationSchema.parse({ code: 'A-01', name: 'Rack A' }))).id;
    emptyLocationWarehouseId = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-E', name: 'No Shelf Yet', use_locations: true }))).id;

    const products = new ProductService(companyId);
    itemA = (await products.create(createProductSchema.parse({ sku: 'ITEM-A', name: 'Item A', product_type: 'Finished' }))).id;
    itemB = (await products.create(createProductSchema.parse({ sku: 'ITEM-B', name: 'Item B', product_type: 'Finished' }))).id;
    notPurchasableItem = (await products.create(createProductSchema.parse({ sku: 'ITEM-N', name: 'Not Bought', product_type: 'Finished', is_purchasable: false }))).id;
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  function purchaseInput(overrides: Partial<PurchaseInput> = {}): PurchaseInput {
    return m.ValidatePurchaseInvoiceInput.parse({
      purchase_date: '2025-08-01',
      supplier_id: supplierId,
      payment_type: 'Credit',
      due_date: '2025-08-31',
      warehouse_id: warehouseId,
      lines: [{ item_id: itemA, quantity: 10, purchase_price: 100 }],
      ...overrides,
    });
  }

  async function createDraft(overrides: Partial<PurchaseInput> = {}) {
    return new m.PurchaseDraftService(companyId).createDraft(purchaseInput(overrides), userId);
  }

  async function balanceOf(itemId: string, warehouse = warehouseId, locationId: string | null = null) {
    const rows = await prisma.$queryRaw<{ stock_on_hand: string; total_stock_value: string; average_cost: string }[]>`
      SELECT stock_on_hand::text, total_stock_value::text, average_cost::text
      FROM inventory_stock_balances
      WHERE company_id = CAST(${companyId} AS uuid) AND item_id = CAST(${itemId} AS uuid)
        AND warehouse_id = CAST(${warehouse} AS uuid) AND location_id IS NOT DISTINCT FROM ${locationId}::uuid
    `;
    return rows[0] ? {
      quantity: new Decimal(rows[0].stock_on_hand).toFixed(4),
      value: new Decimal(rows[0].total_stock_value).toFixed(2),
      average: new Decimal(rows[0].average_cost).toFixed(4),
    } : null;
  }

  async function movementsOf(documentId: string) {
    return prisma.$queryRaw<{ item_id: string; movement_kind: string; warehouse_id: string | null; branch_id: string | null; location_id: string | null; quantity_in: string; quantity_out: string; total_cost: string; movement_date: string }[]>`
      SELECT item_id::text, movement_kind::text, warehouse_id::text, branch_id::text, location_id::text,
        quantity_in::text, quantity_out::text, total_cost::text, movement_date::text
      FROM inventory_stock_movements
      WHERE company_id = CAST(${companyId} AS uuid) AND source_document_id = CAST(${documentId} AS uuid)
      ORDER BY item_id
    `;
  }

  async function invoiceRow(id: string) {
    const rows = await prisma.$queryRaw<{ status: string; purchase_number: string; accounting_voucher_id: string | null; gross_amount: string; discount_amount: string; tax_amount: string; freight_amount: string; net_amount: string; location_id: string | null }[]>`
      SELECT status, purchase_number, accounting_voucher_id::text, gross_amount::text, discount_amount::text, tax_amount::text,
        freight_amount::text, net_amount::text, location_id::text
      FROM purchase_invoices WHERE company_id = CAST(${companyId} AS uuid) AND id = CAST(${id} AS uuid)
    `;
    return rows[0];
  }

  async function voucherFor(id: string) {
    const invoice = await invoiceRow(id);
    return prisma.voucher.findUniqueOrThrow({ where: { id: String(invoice.accounting_voucher_id) }, include: { lines: true } });
  }

  function amountOn(voucher: Awaited<ReturnType<typeof voucherFor>>, accountId: string) {
    const lines = voucher.lines.filter(line => line.accountId === accountId);
    return {
      debit: lines.reduce((sum, line) => sum.plus(line.debitAmount.toString()), new Decimal(0)).toFixed(2),
      credit: lines.reduce((sum, line) => sum.plus(line.creditAmount.toString()), new Decimal(0)).toFixed(2),
    };
  }

  async function companyCount(table: 'inventory_stock_movements' | 'inventory_stock_balances' | 'vouchers' | 'purchase_invoices') {
    const rows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM ${table} WHERE company_id = CAST($1 AS uuid)`, companyId,
    );
    return rows[0].total;
  }

  it('calculates gross, discount, tax, freight and net amounts per line and in total', async () => {
    const result = await new m.PurchaseValidationService(companyId).validate(purchaseInput({
      freight_amount: 15,
      lines: [
        { item_id: itemA, quantity: 10, purchase_price: 100, discount_amount: 50, tax_amount: 20 },
        { item_id: itemB, quantity: 3, purchase_price: 33.33, discount_amount: 0, tax_amount: 0 },
      ],
    }));

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.totals).toEqual({
      gross_amount: '1099.99', discount_amount: '50.00', tax_amount: '20.00', freight_amount: '15.00', net_amount: '1084.99',
    });
    expect(result.lines.map(line => [line.gross_amount, line.line_total])).toEqual([['1000.00', '970.00'], ['99.99', '99.99']]);
    expect(result.location_id).toBeNull();
  });

  it('saves a draft with PI-YYYY-NNNN numbers and does not touch stock or the ledger', async () => {
    const movementsBefore = await companyCount('inventory_stock_movements');
    const balancesBefore = await companyCount('inventory_stock_balances');
    const vouchersBefore = await companyCount('vouchers');

    const first = await createDraft({
      freight_amount: 15,
      supplier_invoice_number: 'BILL-100',
      lines: [
        { item_id: itemA, quantity: 10, purchase_price: 100, discount_amount: 50, tax_amount: 20 },
        { item_id: itemB, quantity: 3, purchase_price: 33.33, discount_amount: 0, tax_amount: 0 },
      ],
    });
    const second = await createDraft({ purchase_date: '2025-08-02' });
    const nextYear = await createDraft({ purchase_date: '2026-01-15', due_date: '2026-02-15' });

    expect(first.purchase_number).toBe('PI-2025-0001');
    expect(second.purchase_number).toBe('PI-2025-0002');
    expect(nextYear.purchase_number).toBe('PI-2026-0001');

    const saved = await invoiceRow(first.id);
    expect(saved.status).toBe('Draft');
    expect(saved.accounting_voucher_id).toBeNull();
    expect(new Decimal(saved.gross_amount).toFixed(2)).toBe('1099.99');
    expect(new Decimal(saved.net_amount).toFixed(2)).toBe('1084.99');

    const detail = await new m.PurchaseDetailService(companyId).getById(first.id);
    expect(detail.lines).toHaveLength(2);
    expect(detail.supplier_invoice_number).toBe('BILL-100');

    expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);
    expect(await companyCount('inventory_stock_balances')).toBe(balancesBefore);
    expect(await companyCount('vouchers')).toBe(vouchersBefore);
  });

  it('posts a credit purchase: balanced voucher, receipt movements and new stock balances', async () => {
    const { data } = await new m.PurchaseListService(companyId).list(m.ListPurchaseInvoicesQuery.parse({ search: 'BILL-100' }));
    const id = (data as Array<{ id: string }>)[0].id;

    const posted = await new m.PurchasePostService(companyId).post(id, userId);
    expect(posted.status).toBe('Posted');
    expect(posted.purchase_number).toBe('PI-2025-0001');

    const voucher = await voucherFor(id);
    expect(voucher.voucherType).toBe('PI');
    expect(voucher.voucherNumber).toBe('PI-2025-0001');
    expect(voucher.status).toBe('Posted');
    expect(voucher.totalDebit.toFixed(2)).toBe(voucher.totalCredit.toFixed(2));
    const debit = voucher.lines.reduce((sum, line) => sum.plus(line.debitAmount.toString()), new Decimal(0));
    const credit = voucher.lines.reduce((sum, line) => sum.plus(line.creditAmount.toString()), new Decimal(0));
    expect(debit.toFixed(2)).toBe(credit.toFixed(2));
    expect(debit.toFixed(2)).toBe('1134.99');

    // Inventory gets the before-discount cost; discount, tax and freight go to their own accounts.
    expect(amountOn(voucher, settings.inventory)).toEqual({ debit: '1099.99', credit: '0.00' });
    expect(amountOn(voucher, settings.tax)).toEqual({ debit: '20.00', credit: '0.00' });
    expect(amountOn(voucher, settings.freight)).toEqual({ debit: '15.00', credit: '0.00' });
    expect(amountOn(voucher, settings.discount)).toEqual({ debit: '0.00', credit: '50.00' });
    expect(amountOn(voucher, supplierAccountId)).toEqual({ debit: '0.00', credit: '1084.99' });

    const movements = await movementsOf(id);
    expect(movements).toHaveLength(2);
    for (const movement of movements) {
      expect(movement.movement_kind).toBe('PURCHASE_RECEIPT');
      expect(movement.warehouse_id).toBe(warehouseId);
      expect(movement.branch_id).toBeNull();
      expect(movement.movement_date).toBe('2025-08-01');
      expect(new Decimal(movement.quantity_out).isZero()).toBe(true);
    }
    const byItem = new Map(movements.map(movement => [movement.item_id, movement]));
    expect(new Decimal(byItem.get(itemA)!.quantity_in).toFixed(4)).toBe('10.0000');
    expect(new Decimal(byItem.get(itemA)!.total_cost).toFixed(2)).toBe('1000.00');
    expect(new Decimal(byItem.get(itemB)!.total_cost).toFixed(2)).toBe('99.99');

    expect(await balanceOf(itemA)).toEqual({ quantity: '10.0000', value: '1000.00', average: '100.0000' });
    expect(await balanceOf(itemB)).toEqual({ quantity: '3.0000', value: '99.99', average: '33.3300' });
  });

  it('refuses to post a posted purchase again and leaves stock and ledger unchanged', async () => {
    const { data } = await new m.PurchaseListService(companyId).list(m.ListPurchaseInvoicesQuery.parse({ search: 'BILL-100' }));
    const id = (data as Array<{ id: string }>)[0].id;
    const movementsBefore = await companyCount('inventory_stock_movements');
    const vouchersBefore = await companyCount('vouchers');

    await expect(new m.PurchasePostService(companyId).post(id, userId)).rejects.toMatchObject({
      message: expect.stringMatching(/Only Draft purchase vouchers can be posted/),
      statusCode: 400,
    });

    expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);
    expect(await companyCount('vouchers')).toBe(vouchersBefore);
    expect(await balanceOf(itemA)).toEqual({ quantity: '10.0000', value: '1000.00', average: '100.0000' });
  });

  it('reports a missing purchase as not found', async () => {
    await expect(new m.PurchasePostService(companyId).post('00000000-0000-4000-8000-000000000000', userId))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates the weighted average cost when the same item is bought again', async () => {
    const draft = await createDraft({ purchase_date: '2025-08-05', lines: [{ item_id: itemA, quantity: 10, purchase_price: 130, discount_amount: 0, tax_amount: 0 }] });
    await new m.PurchasePostService(companyId).post(draft.id, userId);
    expect(await balanceOf(itemA)).toEqual({ quantity: '20.0000', value: '2300.00', average: '115.0000' });
  });

  it('credits the default cash account for a cash purchase', async () => {
    const result = await new m.PurchaseValidationService(companyId).validate(purchaseInput({ payment_type: 'Cash', due_date: undefined }));
    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/default cash account/);

    const draft = await createDraft({ purchase_date: '2025-08-06', payment_type: 'Cash', due_date: undefined, lines: [{ item_id: itemB, quantity: 2, purchase_price: 50, discount_amount: 0, tax_amount: 0 }] });
    await new m.PurchasePostService(companyId).post(draft.id, userId);
    const voucher = await voucherFor(draft.id);
    expect(amountOn(voucher, settings.cash)).toEqual({ debit: '0.00', credit: '100.00' });
    expect(amountOn(voucher, supplierAccountId)).toEqual({ debit: '0.00', credit: '0.00' });
    expect(amountOn(voucher, settings.inventory)).toEqual({ debit: '100.00', credit: '0.00' });
  });

  it('receives into the default Location when the Warehouse uses Locations', async () => {
    const draft = await createDraft({ purchase_date: '2025-08-07', warehouse_id: locationWarehouseId, lines: [{ item_id: itemA, quantity: 4, purchase_price: 25, discount_amount: 0, tax_amount: 0 }] });
    expect((await invoiceRow(draft.id)).location_id).toBe(defaultLocationId);
    await new m.PurchasePostService(companyId).post(draft.id, userId);

    const movements = await movementsOf(draft.id);
    expect(movements[0].location_id).toBe(defaultLocationId);
    expect(await balanceOf(itemA, locationWarehouseId, defaultLocationId)).toEqual({ quantity: '4.0000', value: '100.00', average: '25.0000' });
  });

  it('rejects inputs the schema does not allow (no lines, zero quantity, zero price, negative discount)', () => {
    const base = { purchase_date: '2025-08-01', supplier_id: supplierId, payment_type: 'Credit', warehouse_id: warehouseId };
    const noLines = m.ValidatePurchaseInvoiceInput.safeParse({ ...base, lines: [] });
    expect(noLines.success).toBe(false);
    expect(JSON.stringify(noLines.error?.issues)).toMatch(/Add at least one purchase item/);

    const zeroQuantity = m.ValidatePurchaseInvoiceInput.safeParse({ ...base, lines: [{ item_id: itemA, quantity: 0, purchase_price: 10 }] });
    expect(JSON.stringify(zeroQuantity.error?.issues)).toMatch(/Quantity must be greater than zero/);

    const zeroPrice = m.ValidatePurchaseInvoiceInput.safeParse({ ...base, lines: [{ item_id: itemA, quantity: 1, purchase_price: 0 }] });
    expect(JSON.stringify(zeroPrice.error?.issues)).toMatch(/Purchase Price must be greater than zero/);

    expect(m.ValidatePurchaseInvoiceInput.safeParse({ ...base, lines: [{ item_id: itemA, quantity: 1, purchase_price: 10, discount_amount: -1 }] }).success).toBe(false);
    expect(m.ValidatePurchaseInvoiceInput.safeParse({ ...base, purchase_date: '01-08-2025', lines: [{ item_id: itemA, quantity: 1, purchase_price: 10 }] }).success).toBe(false);
  });

  it('reports business validation errors and saves nothing', async () => {
    const validator = new m.PurchaseValidationService(companyId);
    const errorsFor = async (overrides: Partial<PurchaseInput>) => (await validator.validate(purchaseInput(overrides))).errors.join(' | ');

    expect(await errorsFor({ lines: [{ item_id: itemA, quantity: 1, purchase_price: 10, discount_amount: 11, tax_amount: 0 }] }))
      .toMatch(/Discount cannot be more than the item amount on line 1/);
    expect(await errorsFor({ lines: [{ item_id: itemA, warehouse_id: otherWarehouseId, quantity: 1, purchase_price: 10, discount_amount: 0, tax_amount: 0 }] }))
      .toMatch(/The Warehouse on line 1 must match the selected Warehouse/);
    expect(await errorsFor({ due_date: undefined })).toMatch(/Due Date is required for Credit purchase/);
    expect(await errorsFor({ due_date: '2025-07-15' })).toMatch(/Due Date cannot be before Purchase Date/);
    expect(await errorsFor({ supplier_invoice_date: '2025-08-02' })).toMatch(/Supplier Invoice Date cannot be after Purchase Date/);
    expect(await errorsFor({ lines: [{ item_id: notPurchasableItem, quantity: 1, purchase_price: 10, discount_amount: 0, tax_amount: 0 }] }))
      .toMatch(/not found, are Inactive, or cannot be bought/);
    expect(await errorsFor({ supplier_invoice_number: 'bill-100' })).toMatch(/Supplier Bill No\. is already used on PI-2025-0001/);
    expect(await errorsFor({ warehouse_id: emptyLocationWarehouseId })).toMatch(/create an Active Default Location/);
    expect(await errorsFor({ location_id: defaultLocationId })).toMatch(/Location can only be selected when the Warehouse uses Locations/);
    expect(await errorsFor({ purchase_date: '2024-08-01', due_date: '2024-08-31' })).toMatch(/Date is not in any active Fiscal Year/);
    expect(await errorsFor({ supplier_id: '00000000-0000-4000-8000-000000000000' })).toMatch(/Supplier was not found or is inactive/);

    // The same Supplier Bill No. is fine for a different supplier.
    expect(await errorsFor({ supplier_id: otherSupplierId, supplier_invoice_number: 'BILL-100' })).toBe('');

    const before = await companyCount('purchase_invoices');
    await expect(createDraft({ lines: [{ item_id: itemA, quantity: 1, purchase_price: 10, discount_amount: 11, tax_amount: 0 }] }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(await companyCount('purchase_invoices')).toBe(before);
  });

  it('returns grand totals for every matching purchase, not only the current page', async () => {
    const service = new m.PurchaseListService(companyId);
    const rows = await prisma.$queryRaw<{ gross: string; discount: string; tax: string; freight: string; net: string; total: number }[]>`
      SELECT SUM(gross_amount)::text AS gross, SUM(discount_amount)::text AS discount, SUM(tax_amount)::text AS tax,
        SUM(freight_amount)::text AS freight, SUM(net_amount)::text AS net, COUNT(*)::int AS total
      FROM purchase_invoices WHERE company_id = CAST(${companyId} AS uuid)
    `;
    const firstPage = await service.list(m.ListPurchaseInvoicesQuery.parse({ limit: 1 }));
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.total).toBe(rows[0].total);
    expect(firstPage.totalPages).toBe(rows[0].total);
    expect(new Decimal(firstPage.totals.net_amount).toFixed(2)).toBe(new Decimal(rows[0].net).toFixed(2));
    expect(new Decimal(firstPage.totals.gross_amount).toFixed(2)).toBe(new Decimal(rows[0].gross).toFixed(2));
    expect(new Decimal(firstPage.totals.discount_amount).toFixed(2)).toBe('50.00');
    expect(new Decimal(firstPage.totals.tax_amount).toFixed(2)).toBe('20.00');
    expect(new Decimal(firstPage.totals.freight_amount).toFixed(2)).toBe('15.00');

    const drafts = await service.list(m.ListPurchaseInvoicesQuery.parse({ status: 'Draft' }));
    expect((drafts.data as Array<{ status: string }>).every(row => row.status === 'Draft')).toBe(true);
    expect(drafts.total).toBe(2);
    // Draft PI-2025-0002 (1000.00) and PI-2026-0001 (1000.00).
    expect(new Decimal(drafts.totals.net_amount).toFixed(2)).toBe('2000.00');

    const shelf = await service.list(m.ListPurchaseInvoicesQuery.parse({ warehouse_id: locationWarehouseId }));
    expect(shelf.total).toBe(1);
    expect(new Decimal(shelf.totals.net_amount).toFixed(2)).toBe('100.00');

    const range = await service.list(m.ListPurchaseInvoicesQuery.parse({ date_from: '2026-01-01', date_to: '2026-01-31' }));
    expect((range.data as Array<{ purchase_number: string }>).map(row => row.purchase_number)).toEqual(['PI-2026-0001']);

    const otherSupplier = await service.list(m.ListPurchaseInvoicesQuery.parse({ supplier_id: otherSupplierId }));
    expect(otherSupplier.total).toBe(0);
    expect(new Decimal(otherSupplier.totals.net_amount).toFixed(2)).toBe('0.00');
  });

  it('limits purchases to Warehouse users of that Warehouse and blocks Branch users', async () => {
    const { resolvePurchasingWarehouseId, assertWarehouseDocumentAccess, purchaseWarehouseFilter } = m.access;

    expect(resolvePurchasingWarehouseId(allBranches(), otherWarehouseId, 'Purchase Voucher')).toBe(otherWarehouseId);
    expect(resolvePurchasingWarehouseId(warehouseUser(warehouseId), warehouseId, 'Purchase Voucher')).toBe(warehouseId);
    expect(() => resolvePurchasingWarehouseId(warehouseUser(warehouseId), otherWarehouseId, 'Purchase Voucher'))
      .toThrow(/only create a Purchase Voucher for your own Warehouse/);
    expect(() => resolvePurchasingWarehouseId(branchUser(), warehouseId, 'Purchase Voucher')).toThrow(/Branch users cannot create a Purchase Voucher/);
    expect(purchaseWarehouseFilter(warehouseUser(warehouseId), 'Purchase Voucher')).toBe(warehouseId);
    expect(purchaseWarehouseFilter(allBranches(), 'Purchase Voucher')).toBeNull();

    const draft = await createDraft({ purchase_date: '2025-08-08' });
    await expect(assertWarehouseDocumentAccess(allBranches(), 'purchase_invoices', draft.id)).resolves.toBeUndefined();
    await expect(assertWarehouseDocumentAccess(warehouseUser(warehouseId), 'purchase_invoices', draft.id)).resolves.toBeUndefined();
    await expect(assertWarehouseDocumentAccess(warehouseUser(otherWarehouseId), 'purchase_invoices', draft.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(assertWarehouseDocumentAccess(branchUser(), 'purchase_invoices', draft.id)).rejects.toMatchObject({ statusCode: 403 });

    // The list route adds the user's own Warehouse as a filter.
    const ownList = await new m.PurchaseListService(companyId).list(m.ListPurchaseInvoicesQuery.parse({ warehouse_id: purchaseWarehouseFilter(warehouseUser(otherWarehouseId), 'Purchase Voucher') }));
    expect(ownList.total).toBe(0);
  });

  it('rejects posting into a locked period and keeps the draft unposted', async () => {
    const draft = await createDraft({ purchase_date: '2025-09-10', due_date: '2025-09-30' });
    const periods = await new m.FiscalYearService(companyId).getPeriods(fiscalYearId);
    const september = periods.find(period => period.start_date === '2025-09-01');
    expect(september).toBeDefined();
    await new m.FiscalYearService(companyId).lockPeriod(september!.id);

    const movementsBefore = await companyCount('inventory_stock_movements');
    await expect(new m.PurchasePostService(companyId).post(draft.id, userId)).rejects.toThrow(/Purchase Date cannot be used\. Period "September 2025" is closed/);
    expect((await invoiceRow(draft.id)).status).toBe('Draft');
    expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);

    const result = await new m.PurchaseValidationService(companyId).validate(purchaseInput({ purchase_date: '2025-09-12', due_date: '2025-09-30' }));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Period "September 2025" is closed/);
    await expect(createDraft({ purchase_date: '2025-09-12', due_date: '2025-09-30' })).rejects.toThrow(/is closed/);
  });

  /** Makes posting fail after validation has passed, by making the Default Inventory Account Inactive for the callback. */
  async function withInactiveInventoryAccount(callback: () => Promise<void>) {
    await prisma.account.update({ where: { id: settings.inventory }, data: { isActive: false } });
    try {
      await callback();
    } finally {
      await prisma.account.update({ where: { id: settings.inventory }, data: { isActive: true } });
    }
  }

  describe('Draft lifecycle: save and post together, edit, cancel', () => {
    it('saves and posts in one step', async () => {
      const posted = await new m.PurchaseDraftService(companyId).createAndPost(purchaseInput({ purchase_date: '2025-10-01', due_date: '2025-10-31' }), userId);
      expect(posted.status).toBe('Posted');
      expect((await invoiceRow(posted.id)).status).toBe('Posted');
      expect(await movementsOf(posted.id)).toHaveLength(1);
    });

    it('leaves no draft behind when Save And Post is refused at posting', async () => {
      const invoicesBefore = await companyCount('purchase_invoices');
      const movementsBefore = await companyCount('inventory_stock_movements');
      await withInactiveInventoryAccount(async () => {
        await expect(new m.PurchaseDraftService(companyId).createAndPost(purchaseInput({ purchase_date: '2025-10-02', due_date: '2025-10-31' }), userId))
          .rejects.toThrow(/Default Inventory Account is not set up or is Inactive/);
      });
      expect(await companyCount('purchase_invoices')).toBe(invoicesBefore);
      expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);
    });

    it('edits a draft: same number, new header and lines, totals recalculated, stock and ledger untouched', async () => {
      const draft = await createDraft({ purchase_date: '2025-10-03', due_date: '2025-10-31', supplier_invoice_number: 'BILL-EDIT' });
      const movementsBefore = await companyCount('inventory_stock_movements');
      const vouchersBefore = await companyCount('vouchers');

      const updated = await new m.PurchaseDraftService(companyId).updateDraft(draft.id, purchaseInput({
        purchase_date: '2025-10-04',
        due_date: '2025-11-03',
        supplier_invoice_number: 'BILL-EDIT',
        reference_number: 'REF-2',
        freight_amount: 5,
        lines: [
          { item_id: itemB, quantity: 2, purchase_price: 40, discount_amount: 0, tax_amount: 0 },
          { item_id: itemA, quantity: 1, purchase_price: 10, discount_amount: 0, tax_amount: 0 },
        ],
      }), userId);

      expect(updated).toEqual({ id: draft.id, purchase_number: draft.purchase_number });
      const saved = await invoiceRow(draft.id);
      expect(saved.status).toBe('Draft');
      expect(new Decimal(saved.net_amount).toFixed(2)).toBe('95.00');
      const detail = await new m.PurchaseDetailService(companyId).getById(draft.id);
      expect(detail.reference_number).toBe('REF-2');
      expect(String(detail.purchase_date instanceof Date ? detail.purchase_date.toISOString() : detail.purchase_date)).toMatch(/2025-10-0[34]/);
      expect(detail.lines.map((line: { item_id: string; line_number: number }) => [line.line_number, line.item_id])).toEqual([[1, itemB], [2, itemA]]);
      expect(await companyCount('inventory_stock_movements')).toBe(movementsBefore);
      expect(await companyCount('vouchers')).toBe(vouchersBefore);
    });

    it('does not report a draft\'s own Supplier Bill No. as a duplicate, but still stops another purchase using it', async () => {
      const draft = await createDraft({ purchase_date: '2025-10-05', due_date: '2025-10-31', supplier_invoice_number: 'BILL-OWN' });
      await expect(new m.PurchaseDraftService(companyId).updateDraft(draft.id, purchaseInput({ purchase_date: '2025-10-05', due_date: '2025-10-31', supplier_invoice_number: 'bill-own' }), userId))
        .resolves.toMatchObject({ id: draft.id });
      await expect(createDraft({ purchase_date: '2025-10-05', due_date: '2025-10-31', supplier_invoice_number: 'BILL-OWN' }))
        .rejects.toThrow(/Supplier Bill No\. is already used on/);
    });

    it('refuses to edit a posted purchase or a missing one', async () => {
      const posted = await new m.PurchaseDraftService(companyId).createAndPost(purchaseInput({ purchase_date: '2025-10-06', due_date: '2025-10-31' }), userId);
      await expect(new m.PurchaseDraftService(companyId).updateDraft(posted.id, purchaseInput({ purchase_date: '2025-10-06', due_date: '2025-10-31' }), userId))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Only Draft purchase vouchers can be changed/) });
      await expect(new m.PurchaseDraftService(companyId).updateDraft('00000000-0000-4000-8000-000000000000', purchaseInput({ purchase_date: '2025-10-06', due_date: '2025-10-31' }), userId))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('saves changes and posts a draft in one step, posting the new values', async () => {
      const draft = await createDraft({ purchase_date: '2025-10-07', due_date: '2025-10-31' });
      const posted = await new m.PurchaseDraftService(companyId).updateAndPost(draft.id, purchaseInput({
        purchase_date: '2025-10-07', due_date: '2025-10-31',
        lines: [{ item_id: itemB, quantity: 3, purchase_price: 20, discount_amount: 0, tax_amount: 0 }],
      }), userId);
      expect(posted).toMatchObject({ id: draft.id, purchase_number: draft.purchase_number, status: 'Posted' });
      const voucher = await voucherFor(draft.id);
      expect(amountOn(voucher, supplierAccountId)).toEqual({ debit: '0.00', credit: '60.00' });
      const movements = await movementsOf(draft.id);
      expect(movements.map(movement => [movement.item_id, new Decimal(movement.quantity_in).toFixed(4)])).toEqual([[itemB, '3.0000']]);
    });

    it('keeps the old draft values when Save And Post of an edited draft is refused at posting', async () => {
      const draft = await createDraft({ purchase_date: '2025-10-08', due_date: '2025-10-31' });
      await withInactiveInventoryAccount(async () => {
        await expect(new m.PurchaseDraftService(companyId).updateAndPost(draft.id, purchaseInput({
          purchase_date: '2025-10-08', due_date: '2025-10-31',
          lines: [{ item_id: itemB, quantity: 7, purchase_price: 20, discount_amount: 0, tax_amount: 0 }],
        }), userId)).rejects.toThrow(/Default Inventory Account is not set up or is Inactive/);
      });
      const saved = await invoiceRow(draft.id);
      expect(saved.status).toBe('Draft');
      expect(new Decimal(saved.net_amount).toFixed(2)).toBe('1000.00');
      expect(await movementsOf(draft.id)).toHaveLength(0);
    });

    it('cancels a draft: kept as Voided with who, when and why; it can no longer be posted or edited', async () => {
      const draft = await createDraft({ purchase_date: '2025-10-09', due_date: '2025-10-31', supplier_invoice_number: 'BILL-CANCEL' });
      const service = new m.PurchaseDraftService(companyId);
      const cancelled = await service.cancelDraft(draft.id, { reason: 'Entered twice' }, userId);
      expect(cancelled).toEqual({ id: draft.id, purchase_number: draft.purchase_number, status: 'Voided' });

      const rows = await prisma.$queryRaw<{ status: string; void_reason: string; voided_at: Date | null; voided_by_id: string | null }[]>`
        SELECT status, void_reason, voided_at, voided_by_id::text FROM purchase_invoices WHERE id = CAST(${draft.id} AS uuid)
      `;
      expect(rows[0]).toMatchObject({ status: 'Voided', void_reason: 'Entered twice' });
      expect(rows[0].voided_at).not.toBeNull();

      await expect(new m.PurchasePostService(companyId).post(draft.id, userId)).rejects.toThrow(/Only Draft purchase vouchers can be posted/);
      await expect(service.updateDraft(draft.id, purchaseInput({ purchase_date: '2025-10-09', due_date: '2025-10-31' }), userId)).rejects.toThrow(/Only Draft purchase vouchers can be changed/);
      await expect(service.cancelDraft(draft.id, { reason: 'Again' }, userId)).rejects.toThrow(/Only Draft purchase vouchers can be cancelled/);

      // A cancelled purchase does not block its Supplier Bill No. from being used again.
      await expect(createDraft({ purchase_date: '2025-10-09', due_date: '2025-10-31', supplier_invoice_number: 'BILL-CANCEL' })).resolves.toMatchObject({ id: expect.any(String) });

      const voided = await new m.PurchaseListService(companyId).list(m.ListPurchaseInvoicesQuery.parse({ status: 'Voided' }));
      expect((voided.data as Array<{ id: string }>).map(row => row.id)).toContain(draft.id);
    });

    it('refuses to cancel a posted purchase and needs a reason', async () => {
      const posted = await new m.PurchaseDraftService(companyId).createAndPost(purchaseInput({ purchase_date: '2025-10-10', due_date: '2025-10-31' }), userId);
      await expect(new m.PurchaseDraftService(companyId).cancelDraft(posted.id, { reason: 'Wrong supplier' }, userId))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Only Draft purchase vouchers can be cancelled/) });
      const { CancelPurchaseDraftInput } = await import('../src/modules/purchases/purchase-draft.service.js');
      expect(CancelPurchaseDraftInput.safeParse({ reason: ' ' }).success).toBe(false);
      expect(CancelPurchaseDraftInput.safeParse({}).success).toBe(false);
    });
  });
});
