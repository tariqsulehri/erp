/**
 * Stock Transfer document flow against a real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env):
 * validation -> draft -> posting between Warehouses, Branches and Locations, with quantity and value moving
 * together, the company stock value unchanged, access scope and closed periods.
 * Everything runs inside a new test company that is deleted afterwards.
 */
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

type AccessScope = import('../src/modules/auth/access-rules.js').AccessScope;
type TransferInput = import('../src/modules/stock-transfers/stock-transfer.schema.js').ValidateStockTransferInput;

describe.skipIf(!databaseUrl)('Stock Transfers (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let userId = '';

  let m: {
    StockTransferService: typeof import('../src/modules/stock-transfers/stock-transfer.service.js')['StockTransferService'];
    schema: typeof import('../src/modules/stock-transfers/stock-transfer.schema.js');
    FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
  };

  let fiscalYearId = '';
  let warehouseOne = '';
  let warehouseTwo = '';
  let shelfWarehouse = '';
  let shelfOne = '';
  let branchOne = '';
  let branchTwo = '';
  let itemA = '';
  let serviceItem = '';

  const allBranches = (): AccessScope => ({ companyId, userId, role: 'admin', accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null });
  const branchUser = (branchId: string): AccessScope => ({ companyId, userId, role: 'sales_staff', accessLevel: 'BRANCH', branchId, warehouseId: null });
  const warehouseUser = (warehouseId: string): AccessScope => ({ companyId, userId, role: 'warehouse_staff', accessLevel: 'WAREHOUSE', branchId: null, warehouseId });

  beforeAll(async () => {
    company = await createTestCompany('Stock Transfers');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;

    m = {
      StockTransferService: (await import('../src/modules/stock-transfers/stock-transfer.service.js')).StockTransferService,
      schema: await import('../src/modules/stock-transfers/stock-transfer.schema.js'),
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
    const { PurchaseDraftService } = await import('../src/modules/purchases/purchase-draft.service.js');
    const { PurchasePostService } = await import('../src/modules/purchases/purchase-post.service.js');
    const { ValidatePurchaseInvoiceInput } = await import('../src/modules/purchases/purchase-validation.service.js');

    const year = await new m.FiscalYearService(companyId).create({
      fiscal_year: '2025-2026', year_basis: 'july', start_date: '2025-07-01', end_date: '2026-06-30',
      number_of_periods: 12, posting_cutoff_days: 0,
    });
    fiscalYearId = year.fiscal_year.id;
    await new PostingAccountSettingsService(companyId).get();

    const supplier = await new SupplierService().create(companyId, supplierInputSchema.parse({ name: 'Transfer Supplier' }));
    const branches = new BranchService(companyId);
    branchOne = (await branches.create(createBranchSchema.parse({ code: 'BR-1', name: 'Shop One' }))).id;
    branchTwo = (await branches.create(createBranchSchema.parse({ code: 'BR-2', name: 'Shop Two' }))).id;
    const warehouses = new WarehouseService(companyId);
    warehouseOne = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-1', name: 'Main Warehouse' }))).id;
    warehouseTwo = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-2', name: 'Second Warehouse' }))).id;
    shelfWarehouse = (await warehouses.create(createWarehouseSchema.parse({ code: 'WH-L', name: 'Shelf Warehouse', use_locations: true }))).id;
    shelfOne = (await warehouses.createLocation(shelfWarehouse, createWarehouseLocationSchema.parse({ code: 'L-1', name: 'Shelf One' }))).id;

    const products = new ProductService(companyId);
    itemA = (await products.create(createProductSchema.parse({ sku: 'TR-A', name: 'Transfer Item', product_type: 'Finished' }))).id;
    serviceItem = (await products.create(createProductSchema.parse({ sku: 'TR-S', name: 'Delivery Service', product_type: 'Service', track_inventory: false }))).id;

    // Main Warehouse: 10 @ 100 and 5 @ 130 = 15 units worth 1650.00 (average 110).
    for (const [date, quantity, price] of [['2025-07-10', 10, 100], ['2025-07-11', 5, 130]] as const) {
      const draft = await new PurchaseDraftService(companyId).createDraft(ValidatePurchaseInvoiceInput.parse({
        purchase_date: date, supplier_id: supplier.id, payment_type: 'Cash', warehouse_id: warehouseOne,
        lines: [{ item_id: itemA, quantity, purchase_price: price }],
      }), userId);
      await new PurchasePostService(companyId).post(draft.id, userId);
    }
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  const service = (scope: AccessScope = allBranches()) => new m.StockTransferService(companyId, scope);

  function transferInput(overrides: Partial<TransferInput> = {}): TransferInput {
    return m.schema.ValidateStockTransferInput.parse({
      transfer_date: '2025-08-01',
      from_warehouse_id: warehouseOne,
      to_branch_id: branchOne,
      lines: [{ item_id: itemA, quantity: 6 }],
      ...overrides,
    });
  }

  async function balance(holder: { branchId?: string; warehouseId?: string; locationId?: string }) {
    const rows = await prisma.$queryRaw<{ stock_on_hand: string; total_stock_value: string; average_cost: string }[]>`
      SELECT stock_on_hand::text, total_stock_value::text, average_cost::text
      FROM inventory_stock_balances
      WHERE company_id = CAST(${companyId} AS uuid) AND item_id = CAST(${itemA} AS uuid)
        AND branch_id IS NOT DISTINCT FROM ${holder.branchId ?? null}::uuid
        AND warehouse_id IS NOT DISTINCT FROM ${holder.warehouseId ?? null}::uuid
        AND location_id IS NOT DISTINCT FROM ${holder.locationId ?? null}::uuid
    `;
    return rows[0] ? {
      quantity: new Decimal(rows[0].stock_on_hand).toFixed(4),
      value: new Decimal(rows[0].total_stock_value).toFixed(2),
      average: new Decimal(rows[0].average_cost).toFixed(4),
    } : null;
  }

  async function companyStock() {
    const rows = await prisma.$queryRaw<{ quantity: string; value: string }[]>`
      SELECT COALESCE(SUM(stock_on_hand), 0)::text AS quantity, COALESCE(SUM(total_stock_value), 0)::text AS value
      FROM inventory_stock_balances WHERE company_id = CAST(${companyId} AS uuid)
    `;
    return { quantity: new Decimal(rows[0].quantity).toFixed(4), value: new Decimal(rows[0].value).toFixed(2) };
  }

  async function companyCount(table: 'inventory_stock_movements' | 'inventory_stock_balances' | 'vouchers' | 'stock_transfers') {
    const rows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM ${table} WHERE company_id = CAST($1 AS uuid)`, companyId,
    );
    return rows[0].total;
  }

  async function status(id: string) {
    const rows = await prisma.$queryRaw<{ status: string }[]>`SELECT status FROM stock_transfers WHERE id = CAST(${id} AS uuid)`;
    return rows[0].status;
  }

  it('reports validation errors for places, items and quantities', async () => {
    const errorsFor = async (overrides: Partial<TransferInput>) => (await service().validate(transferInput(overrides))).errors;

    expect(await errorsFor({})).toEqual([]);
    expect(await errorsFor({ to_branch_id: '', to_warehouse_id: warehouseOne })).toContain('From and To cannot be the same place.');
    expect(await errorsFor({ from_branch_id: branchOne })).toContain('From must be a Branch or a Warehouse, not both.');
    expect(await errorsFor({ to_warehouse_id: warehouseTwo })).toContain('To must be a Branch or a Warehouse, not both.');
    expect(await errorsFor({ from_warehouse_id: '' })).toContain('Please select a From Branch or Warehouse.');
    expect(await errorsFor({ lines: [{ item_id: itemA, quantity: 16 }] })).toContain('Not enough stock for line 1. Available Stock is 15.0000.');
    expect(await errorsFor({ from_warehouse_id: warehouseTwo, to_branch_id: branchOne })).toContain('Not enough stock for line 1. Available Stock is 0.0000.');
    expect(await errorsFor({ to_branch_id: '', to_warehouse_id: shelfWarehouse })).toContain('To Location is required because the Warehouse uses Locations.');
    expect(await errorsFor({ to_branch_id: '', to_warehouse_id: warehouseTwo, to_location_id: shelfOne }))
      .toContain('To Location can only be selected when the Warehouse uses Locations.');
    expect(await errorsFor({ to_location_id: shelfOne })).toContain('To Location was not found, Inactive, or does not belong to the selected Branch.');
    expect(await errorsFor({ lines: [{ item_id: serviceItem, quantity: 1 }] })).toContain('One or more transfer items were not found, are Inactive, or are not stock items.');
    expect((await errorsFor({ transfer_date: '2027-08-01' })).join(' ')).toMatch(/Transfer Date: This date is not in any active Fiscal Year/);

    expect(m.schema.ValidateStockTransferInput.safeParse({ transfer_date: '2025-08-01', from_warehouse_id: warehouseOne, to_branch_id: branchOne, lines: [] }).success).toBe(false);
    const zero = m.schema.ValidateStockTransferInput.safeParse({ transfer_date: '2025-08-01', from_warehouse_id: warehouseOne, to_branch_id: branchOne, lines: [{ item_id: itemA, quantity: 0 }] });
    expect(JSON.stringify(zero.error?.issues)).toMatch(/Quantity must be greater than zero/);

    const before = await companyCount('stock_transfers');
    await expect(service().createDraft(transferInput({ lines: [{ item_id: itemA, quantity: 16 }] }), userId)).rejects.toThrow(/Not enough stock/);
    expect(await companyCount('stock_transfers')).toBe(before);
  });

  it('saves a draft numbered ST-YYYY-NNNN without moving stock', async () => {
    const movements = await companyCount('inventory_stock_movements');
    const balances = await companyCount('inventory_stock_balances');
    const draft = await service().createDraft(transferInput({ reference_number: 'MOVE-1' }), userId);
    expect(draft).toMatchObject({ transfer_number: 'ST-2025-0001', status: 'Draft' });

    const detail = await service().getById(draft.id);
    expect(detail).toMatchObject({ status: 'Draft', from_kind: 'WAREHOUSE', to_kind: 'BRANCH', from_code: 'WH-1', to_code: 'BR-1' });
    expect(new Decimal(detail.total_quantity).toFixed(4)).toBe('6.0000');
    expect(new Decimal(detail.total_cost).isZero()).toBe(true);
    expect(detail.lines).toHaveLength(1);

    expect(await companyCount('inventory_stock_movements')).toBe(movements);
    expect(await companyCount('inventory_stock_balances')).toBe(balances);
    expect(await balance({ warehouseId: warehouseOne })).toEqual({ quantity: '15.0000', value: '1650.00', average: '110.0000' });
  });

  it('posts Warehouse -> Branch: TRANSFER_OUT and TRANSFER_IN at average cost, company value unchanged, no voucher', async () => {
    const { data } = await service().list(m.schema.ListStockTransfersQuery.parse({ search: 'MOVE-1' }));
    const id = (data as Array<{ id: string }>)[0].id;
    const vouchers = await companyCount('vouchers');

    const posted = await service().post(id, userId);
    expect(posted).toEqual({ id, transfer_number: 'ST-2025-0001', status: 'Posted' });

    const movements = await prisma.$queryRaw<{ movement_kind: string; branch_id: string | null; warehouse_id: string | null; quantity_in: string; quantity_out: string; unit_cost: string; total_cost: string; stock_after_movement: string }[]>`
      SELECT movement_kind::text, branch_id::text, warehouse_id::text, quantity_in::text, quantity_out::text, unit_cost::text,
        total_cost::text, stock_after_movement::text
      FROM inventory_stock_movements WHERE company_id = CAST(${companyId} AS uuid) AND source_document_id = CAST(${id} AS uuid)
      ORDER BY movement_kind DESC
    `;
    expect(movements).toHaveLength(2);
    const [out, inbound] = movements;
    expect(out).toMatchObject({ movement_kind: 'TRANSFER_OUT', warehouse_id: warehouseOne, branch_id: null });
    expect(new Decimal(out.quantity_out).toFixed(4)).toBe('6.0000');
    expect(new Decimal(out.total_cost).toFixed(2)).toBe('660.00');
    expect(new Decimal(out.stock_after_movement).toFixed(4)).toBe('9.0000');
    expect(inbound).toMatchObject({ movement_kind: 'TRANSFER_IN', branch_id: branchOne, warehouse_id: null });
    expect(new Decimal(inbound.quantity_in).toFixed(4)).toBe('6.0000');
    expect(new Decimal(inbound.unit_cost).toFixed(4)).toBe('110.0000');
    expect(new Decimal(inbound.total_cost).toFixed(2)).toBe('660.00');

    expect(await balance({ warehouseId: warehouseOne })).toEqual({ quantity: '9.0000', value: '990.00', average: '110.0000' });
    expect(await balance({ branchId: branchOne })).toEqual({ quantity: '6.0000', value: '660.00', average: '110.0000' });
    expect(await companyStock()).toEqual({ quantity: '15.0000', value: '1650.00' });
    expect(await companyCount('vouchers')).toBe(vouchers);

    const detail = await service().getById(id);
    expect(detail.status).toBe('Posted');
    expect(new Decimal(detail.total_cost).toFixed(2)).toBe('660.00');
    expect(new Decimal(detail.lines[0].unit_cost).toFixed(4)).toBe('110.0000');
  });

  it('refuses to post a posted transfer again', async () => {
    const { data } = await service().list(m.schema.ListStockTransfersQuery.parse({ search: 'MOVE-1' }));
    const id = (data as Array<{ id: string }>)[0].id;
    await expect(service().post(id, userId)).rejects.toMatchObject({ message: 'Only Draft Stock Transfers can be posted.', statusCode: 400 });
    expect(await balance({ branchId: branchOne })).toEqual({ quantity: '6.0000', value: '660.00', average: '110.0000' });
  });

  it('checks stock again at posting time and rolls back everything when it is not enough', async () => {
    const first = await service().createDraft(transferInput({ transfer_date: '2025-08-02', to_branch_id: branchTwo, lines: [{ item_id: itemA, quantity: 5 }] }), userId);
    const second = await service().createDraft(transferInput({ transfer_date: '2025-08-02', to_branch_id: branchTwo, lines: [{ item_id: itemA, quantity: 5 }] }), userId);
    expect(second.transfer_number).toBe('ST-2025-0003');
    await service().post(first.id, userId);

    const movements = await companyCount('inventory_stock_movements');
    await expect(service().post(second.id, userId)).rejects.toThrow(/Not enough stock for TR-A/);
    expect(await status(second.id)).toBe('Draft');
    expect(await companyCount('inventory_stock_movements')).toBe(movements);
    expect(await balance({ warehouseId: warehouseOne })).toEqual({ quantity: '4.0000', value: '440.00', average: '110.0000' });
    expect(await balance({ branchId: branchTwo })).toEqual({ quantity: '5.0000', value: '550.00', average: '110.0000' });
    expect(await companyStock()).toEqual({ quantity: '15.0000', value: '1650.00' });
  });

  it('moves the whole remaining value when all stock is transferred (Warehouse -> Warehouse)', async () => {
    const result = await service().createAndPost(transferInput({ transfer_date: '2025-08-03', to_branch_id: '', to_warehouse_id: warehouseTwo, lines: [{ item_id: itemA, quantity: 4 }] }), userId);
    expect(result.status).toBe('Posted');
    expect(await balance({ warehouseId: warehouseOne })).toEqual({ quantity: '0.0000', value: '0.00', average: '110.0000' });
    expect(await balance({ warehouseId: warehouseTwo })).toEqual({ quantity: '4.0000', value: '440.00', average: '110.0000' });
    expect(await companyStock()).toEqual({ quantity: '15.0000', value: '1650.00' });
  });

  it('moves stock Branch -> Branch and Branch -> Warehouse Location', async () => {
    await service().createAndPost(transferInput({ transfer_date: '2025-08-04', from_warehouse_id: '', from_branch_id: branchOne, to_branch_id: branchTwo, lines: [{ item_id: itemA, quantity: 2 }] }), userId);
    expect(await balance({ branchId: branchOne })).toEqual({ quantity: '4.0000', value: '440.00', average: '110.0000' });
    expect(await balance({ branchId: branchTwo })).toEqual({ quantity: '7.0000', value: '770.00', average: '110.0000' });

    const toShelf = await service().createAndPost(transferInput({
      transfer_date: '2025-08-04', from_warehouse_id: '', from_branch_id: branchOne, to_branch_id: '', to_warehouse_id: shelfWarehouse, to_location_id: shelfOne,
      lines: [{ item_id: itemA, quantity: 1 }],
    }), userId);
    const detail = await service().getById(toShelf.id);
    expect(detail).toMatchObject({ from_kind: 'BRANCH', to_kind: 'WAREHOUSE', to_location_code: 'L-1' });
    expect(await balance({ warehouseId: shelfWarehouse, locationId: shelfOne })).toEqual({ quantity: '1.0000', value: '110.00', average: '110.0000' });
    expect(await balance({ branchId: branchOne })).toEqual({ quantity: '3.0000', value: '330.00', average: '110.0000' });
    expect(await companyStock()).toEqual({ quantity: '15.0000', value: '1650.00' });
  });

  it('lets Branch and Warehouse users send only from their own place and see only their own transfers', async () => {
    const otherBranch = branchUser(branchTwo);
    const fromBranchOne = transferInput({ transfer_date: '2025-08-05', from_warehouse_id: '', from_branch_id: branchOne, to_branch_id: branchTwo, lines: [{ item_id: itemA, quantity: 1 }] });

    expect((await service(otherBranch).validate(fromBranchOne)).errors).toContain('You can only send stock from your own Branch.');
    expect((await service(warehouseUser(warehouseTwo)).validate(fromBranchOne)).errors).toContain('You can only send stock from your own Warehouse.');
    await expect(service(otherBranch).createDraft(fromBranchOne, userId)).rejects.toThrow(/your own Branch/);

    const draft = await service().createDraft(fromBranchOne, userId);
    await expect(service(otherBranch).post(draft.id, userId)).rejects.toMatchObject({ message: 'You can only send stock for your own Branch.', statusCode: 403 });
    expect(await status(draft.id)).toBe('Draft');
    await service(branchUser(branchOne)).post(draft.id, userId);
    expect(await balance({ branchId: branchOne })).toEqual({ quantity: '2.0000', value: '220.00', average: '110.0000' });

    // A Branch user sees transfers in and out of their Branch; others are "not found".
    const shelfMove = await service().list(m.schema.ListStockTransfersQuery.parse({ to_warehouse_id: shelfWarehouse }));
    const shelfId = (shelfMove.data as Array<{ id: string }>)[0].id;
    await expect(service(branchUser(branchTwo)).getById(shelfId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service(warehouseUser(shelfWarehouse)).getById(shelfId)).resolves.toMatchObject({ id: shelfId });

    const warehouseList = await service(warehouseUser(warehouseTwo)).list(m.schema.ListStockTransfersQuery.parse({}));
    expect(warehouseList.total).toBe(1);
    const branchTwoList = await service(branchUser(branchTwo)).list(m.schema.ListStockTransfersQuery.parse({}));
    expect((branchTwoList.data as Array<{ from_code: string; to_code: string }>).every(row => row.from_code === 'BR-2' || row.to_code === 'BR-2')).toBe(true);
    expect(branchTwoList.total).toBe(4);
    const all = await service().list(m.schema.ListStockTransfersQuery.parse({ status: 'Posted' }));
    expect(all.total).toBe(6);

    // Source stock is only shown for the user's own place.
    await expect(service(branchUser(branchTwo)).getSourceStock({ kind: 'BRANCH', branchId: branchOne, warehouseId: null, locationId: null }))
      .rejects.toMatchObject({ statusCode: 403 });
    const own = await service(branchUser(branchOne)).getSourceStock({ kind: 'BRANCH', branchId: branchOne, warehouseId: null, locationId: null });
    expect(new Decimal(own.find(row => row.item_id === itemA)!.stock_on_hand).toFixed(4)).toBe('2.0000');
  });

  it('filters the list by direction and shows a Branch or Warehouse user only the stock they received', async () => {
    const parse = (query: Record<string, string>) => m.schema.ListStockTransfersQuery.parse({ status: 'Posted', limit: '200', ...query });
    type Row = { from_kind: string; to_kind: string; to_code: string };
    const everything = (await service().list(parse({}))).data as Row[];

    for (const direction of ['BRANCH_TO_BRANCH', 'WAREHOUSE_TO_BRANCH', 'WAREHOUSE_TO_WAREHOUSE', 'BRANCH_TO_WAREHOUSE'] as const) {
      const [from, to] = direction.split('_TO_');
      const rows = (await service().list(parse({ direction }))).data as Row[];
      expect(rows.every(row => row.from_kind === from && row.to_kind === to)).toBe(true);
      expect(rows.length).toBe(everything.filter(row => row.from_kind === from && row.to_kind === to).length);
    }
    expect((await service().list(parse({ direction: 'BRANCH_TO_BRANCH' }))).total).toBeGreaterThan(0);

    // Stock Received for Branch 2: only transfers delivered to BR-2, none it sent.
    const allForBranchTwo = (await service(branchUser(branchTwo)).list(parse({}))).data as Row[];
    const received = (await service(branchUser(branchTwo)).list(parse({ incoming: 'true' }))).data as Row[];
    expect(received.length).toBeGreaterThan(0);
    expect(received.every(row => row.to_code === 'BR-2')).toBe(true);
    expect(received.length).toBe(allForBranchTwo.filter(row => row.to_code === 'BR-2').length);
    expect(m.schema.ListStockTransfersQuery.safeParse({ direction: 'SIDEWAYS' }).success).toBe(false);
  });

  it('rejects posting a transfer into a locked period', async () => {
    const draft = await service().createDraft(transferInput({ transfer_date: '2025-11-03', from_warehouse_id: '', from_branch_id: branchTwo, to_branch_id: branchOne, lines: [{ item_id: itemA, quantity: 1 }] }), userId);
    const fiscalYears = new m.FiscalYearService(companyId);
    const november = (await fiscalYears.getPeriods(fiscalYearId)).find(period => period.start_date === '2025-11-01');
    await fiscalYears.lockPeriod(november!.id);

    await expect(service().post(draft.id, userId)).rejects.toThrow(/Transfer Date cannot be used\. Period "November 2025" is closed/);
    expect(await status(draft.id)).toBe('Draft');
    expect(await balance({ branchId: branchTwo })).toEqual({ quantity: '8.0000', value: '880.00', average: '110.0000' });
    expect((await service().validate(transferInput({ transfer_date: '2025-11-04' }))).errors.join(' ')).toMatch(/Period "November 2025" is closed/);
  });

  const branchTwoToOne = (quantity = 1, date = '2025-12-01') => transferInput({
    transfer_date: date, from_warehouse_id: '', from_branch_id: branchTwo, to_branch_id: branchOne, lines: [{ item_id: itemA, quantity }],
  });

  describe('Draft lifecycle: edit, and save changes and post together', () => {
    it('edits a draft: same number, new lines, no stock moved', async () => {
      const draft = await service().createDraft(branchTwoToOne(1), userId);
      const stockBefore = await balance({ branchId: branchTwo });
      const updated = await service(branchUser(branchTwo)).updateDraft(draft.id, branchTwoToOne(3, '2025-12-02'), userId);
      expect(updated).toEqual({ id: draft.id, transfer_number: draft.transfer_number, status: 'Draft' });
      expect(await status(draft.id)).toBe('Draft');
      const lines = await prisma.$queryRaw<{ quantity: string }[]>`
        SELECT quantity::text FROM stock_transfer_lines WHERE stock_transfer_id = CAST(${draft.id} AS uuid)
      `;
      expect(lines.map(line => new Decimal(line.quantity).toFixed(4))).toEqual(['3.0000']);
      expect(await balance({ branchId: branchTwo })).toEqual(stockBefore);
    });

    it('lets only the sending place change a draft, and refuses posted, missing or short-of-stock changes', async () => {
      const draft = await service().createDraft(branchTwoToOne(1), userId);
      await expect(service(branchUser(branchOne)).updateDraft(draft.id, branchTwoToOne(1), userId))
        .rejects.toMatchObject({ statusCode: 403, message: 'You can only change Stock Transfers for your own Branch.' });
      await expect(service().updateDraft(draft.id, branchTwoToOne(999), userId)).rejects.toThrow(/Not enough stock for line 1/);
      expect(await status(draft.id)).toBe('Draft');
      await expect(service().updateDraft('00000000-0000-4000-8000-000000000000', branchTwoToOne(1), userId)).rejects.toMatchObject({ statusCode: 404 });

      const posted = await service().createAndPost(branchTwoToOne(1), userId);
      await expect(service().updateDraft(posted.id, branchTwoToOne(1), userId))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Only Draft Stock Transfers can be changed/) });
    });

    it('saves changes and posts in one step, moving the new quantity', async () => {
      const draft = await service().createDraft(branchTwoToOne(1), userId);
      const before = await balance({ branchId: branchTwo });
      const posted = await service(branchUser(branchTwo)).updateAndPost(draft.id, branchTwoToOne(2), userId);
      expect(posted).toMatchObject({ id: draft.id, status: 'Posted' });
      const after = await balance({ branchId: branchTwo });
      expect(new Decimal(before!.quantity).minus(after!.quantity).toFixed(4)).toBe('2.0000');
    });

    it('cancels a draft: kept as Voided with who, when and why; only the sending place may cancel it', async () => {
      const draft = await service().createDraft(branchTwoToOne(1), userId);
      await expect(service(branchUser(branchOne)).cancelDraft(draft.id, { reason: 'Not mine' }, userId))
        .rejects.toMatchObject({ statusCode: 403, message: 'You can only cancel Stock Transfers for your own Branch.' });
      expect(await service(branchUser(branchTwo)).cancelDraft(draft.id, { reason: 'Sent by mistake' }, userId))
        .toEqual({ id: draft.id, transfer_number: draft.transfer_number, status: 'Voided' });
      const rows = await prisma.$queryRaw<{ status: string; void_reason: string; voided_at: Date | null }[]>`
        SELECT status, void_reason, voided_at FROM stock_transfers WHERE id = CAST(${draft.id} AS uuid)
      `;
      expect(rows[0]).toMatchObject({ status: 'Voided', void_reason: 'Sent by mistake' });
      expect(rows[0].voided_at).not.toBeNull();
      await expect(service().post(draft.id, userId)).rejects.toThrow(/Only Draft Stock Transfers can be posted/);
      await expect(service().updateDraft(draft.id, branchTwoToOne(1), userId)).rejects.toThrow(/Only Draft Stock Transfers can be changed/);
      await expect(service().cancelDraft(draft.id, { reason: 'Again' }, userId)).rejects.toThrow(/Only Draft Stock Transfers can be cancelled/);
      await expect(service().cancelDraft('00000000-0000-4000-8000-000000000000', { reason: 'Missing' }, userId)).rejects.toMatchObject({ statusCode: 404 });
      expect(m.schema.CancelStockTransferDraftInput.safeParse({ reason: ' ' }).success).toBe(false);
    });
  });
});
