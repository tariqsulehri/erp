/**
 * Stock Adjustment document flow against a real PostgreSQL database (TEST_DATABASE_URL, or DATABASE_URL from .env):
 * validation -> draft -> posting of Increase and Decrease lines, with weighted-average cost, the gain / loss
 * accounts from Posting Account Settings, access scope and closed periods.
 * Everything runs inside a new test company that is deleted afterwards.
 */
import { Decimal } from 'decimal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, type TestCompany } from './support/test-database.js';

type AccessScope = import('../src/modules/auth/access-rules.js').AccessScope;
type AdjustmentInput = import('../src/modules/stock-adjustments/stock-adjustment.schema.js').ValidateStockAdjustmentInput;

describe.skipIf(!databaseUrl)('Stock Adjustments (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let userId = '';

  let m: {
    StockAdjustmentService: typeof import('../src/modules/stock-adjustments/stock-adjustment.service.js')['StockAdjustmentService'];
    schema: typeof import('../src/modules/stock-adjustments/stock-adjustment.schema.js');
    FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
  };

  let fiscalYearId = '';
  let accounts: { inventory: string; gain: string; loss: string };
  let warehouseId = '';
  let branchOne = '';
  let branchTwo = '';
  let itemA = '';
  let itemB = '';
  let itemC = '';
  let itemD = '';
  let serviceItem = '';

  const allBranches = (): AccessScope => ({ companyId, userId, role: 'admin', accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null });
  const branchUser = (branchId: string): AccessScope => ({ companyId, userId, role: 'manager', accessLevel: 'BRANCH', branchId, warehouseId: null });
  const warehouseUser = (): AccessScope => ({ companyId, userId, role: 'warehouse_staff', accessLevel: 'WAREHOUSE', branchId: null, warehouseId });

  beforeAll(async () => {
    company = await createTestCompany('Stock Adjustments');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;

    m = {
      StockAdjustmentService: (await import('../src/modules/stock-adjustments/stock-adjustment.service.js')).StockAdjustmentService,
      schema: await import('../src/modules/stock-adjustments/stock-adjustment.schema.js'),
      FiscalYearService: (await import('../src/modules/fiscal-years/fiscal-year.service.js')).FiscalYearService,
    };
    const { PostingAccountSettingsService } = await import('../src/modules/settings/posting-account-settings.service.js');
    const { WarehouseService } = await import('../src/modules/inventory/warehouse.service.js');
    const { createWarehouseSchema } = await import('../src/modules/inventory/warehouse.schema.js');
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
    accounts = {
      inventory: String(posting.stock_adjustment?.default_inventory_account_id),
      gain: String(posting.stock_adjustment?.adjustment_gain_account_id),
      loss: String(posting.stock_adjustment?.adjustment_loss_account_id),
    };

    const branches = new BranchService(companyId);
    branchOne = (await branches.create(createBranchSchema.parse({ code: 'BR-1', name: 'Shop One' }))).id;
    branchTwo = (await branches.create(createBranchSchema.parse({ code: 'BR-2', name: 'Shop Two' }))).id;
    warehouseId = (await new WarehouseService(companyId).create(createWarehouseSchema.parse({ code: 'WH-1', name: 'Main Warehouse' }))).id;

    const products = new ProductService(companyId);
    itemA = (await products.create(createProductSchema.parse({ sku: 'ADJ-A', name: 'Adjust A', product_type: 'Finished' }))).id;
    itemB = (await products.create(createProductSchema.parse({ sku: 'ADJ-B', name: 'Adjust B', product_type: 'Finished' }))).id;
    itemC = (await products.create(createProductSchema.parse({ sku: 'ADJ-C', name: 'Adjust C', product_type: 'Finished' }))).id;
    itemD = (await products.create(createProductSchema.parse({ sku: 'ADJ-D', name: 'Adjust D', product_type: 'Finished' }))).id;
    serviceItem = (await products.create(createProductSchema.parse({ sku: 'ADJ-S', name: 'Service Only', product_type: 'Service', track_inventory: false }))).id;
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  const service = (scope: AccessScope = allBranches()) => new m.StockAdjustmentService(companyId, scope);

  function adjustmentInput(overrides: Partial<AdjustmentInput> = {}): AdjustmentInput {
    return m.schema.ValidateStockAdjustmentInput.parse({
      adjustment_date: '2025-08-01',
      warehouse_id: warehouseId,
      lines: [{ adjustment_type: 'Increase', item_id: itemA, quantity: 10, unit_cost: 50 }],
      ...overrides,
    });
  }

  async function balance(itemId: string, holder: { branchId?: string; warehouseId?: string } = { warehouseId }) {
    const rows = await prisma.$queryRaw<{ stock_on_hand: string; total_stock_value: string; average_cost: string }[]>`
      SELECT stock_on_hand::text, total_stock_value::text, average_cost::text
      FROM inventory_stock_balances
      WHERE company_id = CAST(${companyId} AS uuid) AND item_id = CAST(${itemId} AS uuid)
        AND branch_id IS NOT DISTINCT FROM ${holder.branchId ?? null}::uuid
        AND warehouse_id IS NOT DISTINCT FROM ${holder.warehouseId ?? null}::uuid
    `;
    return rows[0] ? {
      quantity: new Decimal(rows[0].stock_on_hand).toFixed(4),
      value: new Decimal(rows[0].total_stock_value).toFixed(2),
      average: new Decimal(rows[0].average_cost).toFixed(4),
    } : null;
  }

  async function header(id: string) {
    const rows = await prisma.$queryRaw<{ status: string; accounting_voucher_id: string | null; total_quantity_in: string; total_quantity_out: string; total_cost_in: string; total_cost_out: string }[]>`
      SELECT status, accounting_voucher_id::text, total_quantity_in::text, total_quantity_out::text, total_cost_in::text, total_cost_out::text
      FROM stock_adjustments WHERE company_id = CAST(${companyId} AS uuid) AND id = CAST(${id} AS uuid)
    `;
    return rows[0];
  }

  async function voucherFor(id: string) {
    const row = await header(id);
    return prisma.voucher.findUniqueOrThrow({ where: { id: String(row.accounting_voucher_id) }, include: { lines: true } });
  }

  function amountOn(voucher: Awaited<ReturnType<typeof voucherFor>>, accountId: string) {
    const lines = voucher.lines.filter(line => line.accountId === accountId);
    return {
      debit: lines.reduce((sum, line) => sum.plus(line.debitAmount.toString()), new Decimal(0)).toFixed(2),
      credit: lines.reduce((sum, line) => sum.plus(line.creditAmount.toString()), new Decimal(0)).toFixed(2),
    };
  }

  async function movementsOf(id: string) {
    return prisma.$queryRaw<{ item_id: string; movement_kind: string; branch_id: string | null; warehouse_id: string | null; quantity_in: string; quantity_out: string; unit_cost: string; total_cost: string }[]>`
      SELECT item_id::text, movement_kind::text, branch_id::text, warehouse_id::text, quantity_in::text, quantity_out::text, unit_cost::text, total_cost::text
      FROM inventory_stock_movements WHERE company_id = CAST(${companyId} AS uuid) AND source_document_id = CAST(${id} AS uuid)
    `;
  }

  async function companyCount(table: 'inventory_stock_movements' | 'inventory_stock_balances' | 'vouchers' | 'stock_adjustments') {
    const rows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM ${table} WHERE company_id = CAST($1 AS uuid)`, companyId,
    );
    return rows[0].total;
  }

  /** Inventory account balance in the ledger and the stock value of all balance rows. */
  async function inventoryLedgerAndStock() {
    const ledger = await prisma.$queryRaw<{ amount: string }[]>`
      SELECT COALESCE(SUM(vl.dr_amount - vl.cr_amount), 0)::text AS amount
      FROM voucher_lines vl JOIN vouchers v ON v.id = vl.voucher_id
      WHERE vl.company_id = CAST(${companyId} AS uuid) AND vl.account_id = CAST(${accounts.inventory} AS uuid) AND v.status = 'Posted'
    `;
    const stock = await prisma.$queryRaw<{ amount: string }[]>`
      SELECT COALESCE(SUM(total_stock_value), 0)::text AS amount FROM inventory_stock_balances WHERE company_id = CAST(${companyId} AS uuid)
    `;
    return { ledger: new Decimal(ledger[0].amount).toFixed(2), stock: new Decimal(stock[0].amount).toFixed(2) };
  }

  it('reports validation errors for place, items, stock and cost', async () => {
    const errorsFor = async (overrides: Partial<AdjustmentInput>) => (await service().validate(adjustmentInput(overrides))).errors;

    expect(await errorsFor({})).toEqual([]);
    expect(await errorsFor({ warehouse_id: '' })).toContain('Please select a Branch or Warehouse.');
    expect(await errorsFor({ branch_id: branchOne })).toContain('Select a Branch or a Warehouse, not both.');
    expect(await errorsFor({ lines: [{ adjustment_type: 'Decrease', item_id: itemA, quantity: 1, unit_cost: 0 }] }))
      .toContain('Not enough stock for line 1. Available Stock is 0.0000.');
    expect(await errorsFor({ lines: [{ adjustment_type: 'Increase', item_id: serviceItem, quantity: 1, unit_cost: 5 }] }))
      .toContain('One or more adjustment items were not found, are Inactive, or are not stock items.');
    expect((await errorsFor({ adjustment_date: '2026-07-01' })).join(' ')).toMatch(/Adjustment Date: This date is not in any active Fiscal Year/);

    const base = { adjustment_date: '2025-08-01', warehouse_id: warehouseId };
    expect(m.schema.ValidateStockAdjustmentInput.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(JSON.stringify(m.schema.ValidateStockAdjustmentInput.safeParse({ ...base, lines: [{ adjustment_type: 'Increase', item_id: itemA, quantity: 0, unit_cost: 1 }] }).error?.issues))
      .toMatch(/Quantity must be greater than zero/);
    expect(JSON.stringify(m.schema.ValidateStockAdjustmentInput.safeParse({ ...base, lines: [{ adjustment_type: 'Increase', item_id: itemA, quantity: 1, unit_cost: -1 }] }).error?.issues))
      .toMatch(/Unit Cost cannot be negative/);
    expect(m.schema.ValidateStockAdjustmentInput.safeParse({ ...base, lines: [{ adjustment_type: 'Found', item_id: itemA, quantity: 1 }] }).success).toBe(false);

    const before = await companyCount('stock_adjustments');
    await expect(service().createDraft(adjustmentInput({ warehouse_id: '' }), userId)).rejects.toThrow(/Please select a Branch or Warehouse/);
    expect(await companyCount('stock_adjustments')).toBe(before);
  });

  it('saves a draft numbered SA-YYYY-NNNN with totals and no stock or ledger change', async () => {
    const draft = await service().createDraft(adjustmentInput({ reference_number: 'COUNT-1', reason: 'Stock count' }), userId);
    expect(draft).toMatchObject({ adjustment_number: 'SA-2025-0001', status: 'Draft' });

    const saved = await header(draft.id);
    expect(saved.status).toBe('Draft');
    expect(saved.accounting_voucher_id).toBeNull();
    expect(new Decimal(saved.total_quantity_in).toFixed(4)).toBe('10.0000');
    expect(new Decimal(saved.total_cost_in).toFixed(2)).toBe('500.00');
    expect(new Decimal(saved.total_quantity_out).isZero()).toBe(true);

    const detail = await service().getById(draft.id);
    expect(detail.lines).toHaveLength(1);
    expect(new Decimal(detail.lines[0].total_cost).toFixed(2)).toBe('500.00');

    expect(await companyCount('inventory_stock_movements')).toBe(0);
    expect(await companyCount('inventory_stock_balances')).toBe(0);
    expect(await companyCount('vouchers')).toBe(0);
  });

  it('posts an Increase: ADJUSTMENT_IN movement, new balance and Inventory / Gain voucher from settings', async () => {
    const { data } = await service().list(m.schema.ListStockAdjustmentsQuery.parse({ search: 'COUNT-1' }));
    const id = (data as Array<{ id: string }>)[0].id;
    expect(await service().post(id, userId)).toEqual({ id, adjustment_number: 'SA-2025-0001', status: 'Posted' });

    const movements = await movementsOf(id);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ movement_kind: 'ADJUSTMENT_IN', warehouse_id: warehouseId, branch_id: null });
    expect(new Decimal(movements[0].quantity_in).toFixed(4)).toBe('10.0000');
    expect(new Decimal(movements[0].total_cost).toFixed(2)).toBe('500.00');
    expect(await balance(itemA)).toEqual({ quantity: '10.0000', value: '500.00', average: '50.0000' });

    const voucher = await voucherFor(id);
    expect(voucher.voucherType).toBe('SA');
    expect(voucher.voucherNumber).toBe('SA-2025-0001');
    expect(voucher.totalDebit.toFixed(2)).toBe('500.00');
    expect(voucher.totalCredit.toFixed(2)).toBe('500.00');
    expect(amountOn(voucher, accounts.inventory)).toEqual({ debit: '500.00', credit: '0.00' });
    expect(amountOn(voucher, accounts.gain)).toEqual({ debit: '0.00', credit: '500.00' });
    // Zero loss lines are dropped from the voucher.
    expect(voucher.lines).toHaveLength(2);
  });

  it('takes Decrease cost from the weighted average, not from the entered unit cost', async () => {
    await service().createAndPost(adjustmentInput({ adjustment_date: '2025-08-02', lines: [{ adjustment_type: 'Increase', item_id: itemA, quantity: 10, unit_cost: 80 }] }), userId);
    expect(await balance(itemA)).toEqual({ quantity: '20.0000', value: '1300.00', average: '65.0000' });

    const draft = await service().createDraft(adjustmentInput({ adjustment_date: '2025-08-03', lines: [{ adjustment_type: 'Decrease', item_id: itemA, quantity: 4, unit_cost: 999 }] }), userId);
    const saved = await service().getById(draft.id);
    expect(new Decimal(saved.lines[0].unit_cost).toFixed(4)).toBe('65.0000');
    expect(new Decimal(saved.total_cost_out).toFixed(2)).toBe('260.00');

    await service().post(draft.id, userId);
    expect(await balance(itemA)).toEqual({ quantity: '16.0000', value: '1040.00', average: '65.0000' });
    const movements = await movementsOf(draft.id);
    expect(movements[0].movement_kind).toBe('ADJUSTMENT_OUT');
    expect(new Decimal(movements[0].quantity_out).toFixed(4)).toBe('4.0000');
    expect(new Decimal(movements[0].total_cost).toFixed(2)).toBe('260.00');

    const voucher = await voucherFor(draft.id);
    expect(amountOn(voucher, accounts.loss)).toEqual({ debit: '260.00', credit: '0.00' });
    expect(amountOn(voucher, accounts.inventory)).toEqual({ debit: '0.00', credit: '260.00' });
    expect(amountOn(voucher, accounts.gain)).toEqual({ debit: '0.00', credit: '0.00' });
    expect(await inventoryLedgerAndStock()).toEqual({ ledger: '1040.00', stock: '1040.00' });
  });

  it('posts Increase and Decrease lines together in one balanced voucher', async () => {
    const result = await service().createAndPost(adjustmentInput({
      adjustment_date: '2025-08-04',
      lines: [
        { adjustment_type: 'Increase', item_id: itemB, quantity: 5, unit_cost: 20 },
        { adjustment_type: 'Decrease', item_id: itemA, quantity: 1, unit_cost: 0 },
      ],
    }), userId);
    const saved = await header(result.id);
    expect(new Decimal(saved.total_cost_in).toFixed(2)).toBe('100.00');
    expect(new Decimal(saved.total_cost_out).toFixed(2)).toBe('65.00');

    const voucher = await voucherFor(result.id);
    expect(voucher.totalDebit.toFixed(2)).toBe('165.00');
    expect(voucher.totalCredit.toFixed(2)).toBe('165.00');
    expect(amountOn(voucher, accounts.inventory)).toEqual({ debit: '100.00', credit: '65.00' });
    expect(amountOn(voucher, accounts.gain)).toEqual({ debit: '0.00', credit: '100.00' });
    expect(amountOn(voucher, accounts.loss)).toEqual({ debit: '65.00', credit: '0.00' });
    expect((await movementsOf(result.id)).map(row => row.movement_kind).sort()).toEqual(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']);
    expect(await balance(itemA)).toEqual({ quantity: '15.0000', value: '975.00', average: '65.0000' });
    expect(await balance(itemB)).toEqual({ quantity: '5.0000', value: '100.00', average: '20.0000' });
    expect(await inventoryLedgerAndStock()).toEqual({ ledger: '1075.00', stock: '1075.00' });
  });

  it('takes the whole remaining value when all stock is removed', async () => {
    // 3 units worth 100.00 have an average of 33.3333; removing all 3 must leave exactly zero value.
    await service().createAndPost(adjustmentInput({ adjustment_date: '2025-08-05', lines: [{ adjustment_type: 'Increase', item_id: itemC, quantity: 3, unit_cost: 33.3333 }] }), userId);
    const before = await balance(itemC);
    const result = await service().createAndPost(adjustmentInput({ adjustment_date: '2025-08-05', lines: [{ adjustment_type: 'Decrease', item_id: itemC, quantity: 3, unit_cost: 0 }] }), userId);
    expect(await balance(itemC)).toEqual({ quantity: '0.0000', value: '0.00', average: '0.0000' });
    const voucher = await voucherFor(result.id);
    expect(amountOn(voucher, accounts.loss).debit).toBe(before!.value);
  });

  it('refuses to post a posted adjustment again', async () => {
    const { data } = await service().list(m.schema.ListStockAdjustmentsQuery.parse({ search: 'COUNT-1' }));
    const id = (data as Array<{ id: string }>)[0].id;
    await expect(service().post(id, userId)).rejects.toMatchObject({ message: 'Only Draft Stock Adjustments can be posted.', statusCode: 400 });
    expect(await balance(itemA)).toEqual({ quantity: '15.0000', value: '975.00', average: '65.0000' });
  });

  it('checks stock again at posting time and rolls back the whole adjustment', async () => {
    const first = await service().createDraft(adjustmentInput({ adjustment_date: '2025-08-06', lines: [{ adjustment_type: 'Decrease', item_id: itemA, quantity: 10, unit_cost: 0 }] }), userId);
    const second = await service().createDraft(adjustmentInput({
      adjustment_date: '2025-08-06',
      lines: [
        { adjustment_type: 'Increase', item_id: itemB, quantity: 1, unit_cost: 20 },
        { adjustment_type: 'Decrease', item_id: itemA, quantity: 10, unit_cost: 0 },
      ],
    }), userId);
    await service().post(first.id, userId);
    const movements = await companyCount('inventory_stock_movements');
    const vouchers = await companyCount('vouchers');

    await expect(service().post(second.id, userId)).rejects.toThrow(/Not enough stock for ADJ-A/);
    expect((await header(second.id)).status).toBe('Draft');
    expect(await companyCount('inventory_stock_movements')).toBe(movements);
    expect(await companyCount('vouchers')).toBe(vouchers);
    expect(await balance(itemA)).toEqual({ quantity: '5.0000', value: '325.00', average: '65.0000' });
    expect(await balance(itemB)).toEqual({ quantity: '5.0000', value: '100.00', average: '20.0000' });
  });

  it('lets Branch and Warehouse users adjust only their own place', async () => {
    const branchOneUser = branchUser(branchOne);
    const atBranchOne = adjustmentInput({ adjustment_date: '2025-08-07', warehouse_id: '', branch_id: branchOne, lines: [{ adjustment_type: 'Increase', item_id: itemA, quantity: 2, unit_cost: 70 }] });

    const own = await service(branchOneUser).createAndPost(atBranchOne, userId);
    expect(own.status).toBe('Posted');
    expect(await balance(itemA, { branchId: branchOne })).toEqual({ quantity: '2.0000', value: '140.00', average: '70.0000' });
    const movements = await movementsOf(own.id);
    expect(movements[0]).toMatchObject({ branch_id: branchOne, warehouse_id: null });

    expect((await service(branchUser(branchTwo)).validate(atBranchOne)).errors).toContain('You can only adjust stock of your own Branch.');
    expect((await service(warehouseUser()).validate(atBranchOne)).errors).toContain('You can only adjust stock of your own Warehouse.');
    await expect(service(branchUser(branchTwo)).createDraft(atBranchOne, userId)).rejects.toThrow(/your own Branch/);

    const draft = await service().createDraft({ ...atBranchOne, adjustment_date: '2025-08-08' }, userId);
    await expect(service(branchUser(branchTwo)).post(draft.id, userId))
      .rejects.toMatchObject({ message: 'You can only post Stock Adjustments for your own Branch.', statusCode: 403 });
    await expect(service(warehouseUser()).post(draft.id, userId)).rejects.toMatchObject({ statusCode: 403 });
    expect((await header(draft.id)).status).toBe('Draft');
    await expect(service(branchUser(branchTwo)).getById(draft.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service(branchOneUser).getById(draft.id)).resolves.toMatchObject({ id: draft.id });

    expect((await service(branchOneUser).list(m.schema.ListStockAdjustmentsQuery.parse({}))).total).toBe(2);
    expect((await service(branchUser(branchTwo)).list(m.schema.ListStockAdjustmentsQuery.parse({}))).total).toBe(0);
    const warehouseList = await service(warehouseUser()).list(m.schema.ListStockAdjustmentsQuery.parse({}));
    expect((warehouseList.data as Array<{ warehouse_code: string | null }>).every(row => row.warehouse_code === 'WH-1')).toBe(true);
  });

  it('filters the list by adjustment type and status', async () => {
    const decreases = await service().list(m.schema.ListStockAdjustmentsQuery.parse({ adjustment_type: 'Decrease', status: 'Posted' }));
    // SA-0003 (Decrease A 4), SA-0004 (mixed), SA-0006 (Decrease C 3) and SA-0007 (Decrease A 10).
    expect((decreases.data as Array<{ adjustment_number: string }>).map(row => row.adjustment_number).sort())
      .toEqual(['SA-2025-0003', 'SA-2025-0004', 'SA-2025-0006', 'SA-2025-0007']);
    const drafts = await service().list(m.schema.ListStockAdjustmentsQuery.parse({ status: 'Draft' }));
    expect(drafts.total).toBe(2);
  });

  it('rejects posting an adjustment into a locked period', async () => {
    const draft = await service().createDraft(adjustmentInput({ adjustment_date: '2026-02-10', lines: [{ adjustment_type: 'Increase', item_id: itemB, quantity: 1, unit_cost: 20 }] }), userId);
    expect(draft.adjustment_number).toBe('SA-2026-0001');
    const fiscalYears = new m.FiscalYearService(companyId);
    const february = (await fiscalYears.getPeriods(fiscalYearId)).find(period => period.start_date === '2026-02-01');
    await fiscalYears.lockPeriod(february!.id);

    await expect(service().post(draft.id, userId)).rejects.toThrow(/Adjustment Date cannot be used\. Period "February 2026" is closed/);
    expect((await header(draft.id)).status).toBe('Draft');
    expect(await balance(itemB)).toEqual({ quantity: '5.0000', value: '100.00', average: '20.0000' });
    expect((await service().validate(adjustmentInput({ adjustment_date: '2026-02-11' }))).errors.join(' ')).toMatch(/Period "February 2026" is closed/);
  });

  it('keeps the ledger Inventory equal to stock value after every posted adjustment', async () => {
    const { ledger, stock } = await inventoryLedgerAndStock();
    expect(ledger).toBe(stock);
  });

  // Regression: each Increase line cost is rounded to 2 decimals so the voucher equals the sum of stored stock values.
  it('keeps Inventory equal to stock value when Increase unit costs have more than 2 decimals', async () => {
    const before = await inventoryLedgerAndStock();
    await service().createAndPost(adjustmentInput({
      adjustment_date: '2025-08-20',
      lines: [
        { adjustment_type: 'Increase', item_id: itemD, quantity: 1, unit_cost: 10.125 },
        { adjustment_type: 'Increase', item_id: itemC, quantity: 1, unit_cost: 10.125 },
      ],
    }), userId);
    const after = await inventoryLedgerAndStock();
    const ledgerChange = new Decimal(after.ledger).minus(before.ledger).toFixed(2);
    const stockChange = new Decimal(after.stock).minus(before.stock).toFixed(2);
    expect(ledgerChange).toBe(stockChange);
  });

  /** Makes posting fail after validation has passed, by making the Stock Adjustment Gain Account Inactive for the callback. */
  async function withInactiveGainAccount(callback: () => Promise<void>) {
    await prisma.account.update({ where: { id: accounts.gain }, data: { isActive: false } });
    try {
      await callback();
    } finally {
      await prisma.account.update({ where: { id: accounts.gain }, data: { isActive: true } });
    }
  }

  const increaseC = (quantity = 1, unitCost = 10) => [{ adjustment_type: 'Increase' as const, item_id: itemC, quantity, unit_cost: unitCost }];

  describe('Draft lifecycle: save and post together, edit', () => {
    it('leaves no draft behind when Save And Post is refused at posting', async () => {
      const adjustmentsBefore = await companyCount('stock_adjustments');
      const stockBefore = await balance(itemC);
      await withInactiveGainAccount(async () => {
        await expect(service().createAndPost(adjustmentInput({ adjustment_date: '2025-09-01', lines: increaseC() }), userId))
          .rejects.toThrow(/Stock Adjustment Gain Account is not set up or is Inactive/);
      });
      expect(await companyCount('stock_adjustments')).toBe(adjustmentsBefore);
      expect(await balance(itemC)).toEqual(stockBefore);
    });

    it('edits a draft: same number, new lines and totals, no stock change', async () => {
      const draft = await service().createDraft(adjustmentInput({ adjustment_date: '2025-09-02', lines: increaseC() }), userId);
      const stockBefore = await balance(itemC);
      const updated = await service().updateDraft(draft.id, adjustmentInput({ adjustment_date: '2025-09-03', reason: 'Recount', lines: increaseC(3, 12) }), userId);
      expect(updated).toEqual({ id: draft.id, adjustment_number: draft.adjustment_number, status: 'Draft' });
      const row = await header(draft.id);
      expect(row.status).toBe('Draft');
      expect(new Decimal(row.total_quantity_in).toFixed(4)).toBe('3.0000');
      expect(new Decimal(row.total_cost_in).toFixed(2)).toBe('36.00');
      expect(await balance(itemC)).toEqual(stockBefore);
    });

    it('refuses to edit a posted, missing or other-place adjustment', async () => {
      const posted = await service().createAndPost(adjustmentInput({ adjustment_date: '2025-09-04', lines: increaseC() }), userId);
      await expect(service().updateDraft(posted.id, adjustmentInput({ adjustment_date: '2025-09-04', lines: increaseC() }), userId))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Only Draft Stock Adjustments can be changed/) });
      await expect(service().updateDraft('00000000-0000-4000-8000-000000000000', adjustmentInput({ adjustment_date: '2025-09-04', lines: increaseC() }), userId))
        .rejects.toMatchObject({ statusCode: 404 });
      const draft = await service().createDraft(adjustmentInput({ adjustment_date: '2025-09-04', lines: increaseC() }), userId);
      await expect(service(branchUser(branchOne)).updateDraft(draft.id, adjustmentInput({ adjustment_date: '2025-09-04', lines: increaseC() }), userId))
        .rejects.toMatchObject({ statusCode: 403, message: 'You can only change Stock Adjustments for your own Branch.' });
    });

    it('saves changes and posts in one step, keeping the old values when posting is refused', async () => {
      const draft = await service().createDraft(adjustmentInput({ adjustment_date: '2025-09-05', lines: increaseC() }), userId);
      const stockBefore = await balance(itemC);
      await withInactiveGainAccount(async () => {
        await expect(service().updateAndPost(draft.id, adjustmentInput({ adjustment_date: '2025-09-05', lines: increaseC(5, 10) }), userId))
          .rejects.toThrow(/Stock Adjustment Gain Account is not set up or is Inactive/);
      });
      const kept = await header(draft.id);
      expect(kept.status).toBe('Draft');
      expect(new Decimal(kept.total_quantity_in).toFixed(4)).toBe('1.0000');
      expect(await balance(itemC)).toEqual(stockBefore);

      const posted = await service().updateAndPost(draft.id, adjustmentInput({ adjustment_date: '2025-09-05', lines: increaseC(2, 10) }), userId);
      expect(posted).toMatchObject({ id: draft.id, status: 'Posted' });
      expect(amountOn(await voucherFor(draft.id), accounts.gain)).toEqual({ debit: '0.00', credit: '20.00' });
    });

    it('cancels a draft: kept as Voided with who, when and why; it can no longer be posted, edited or cancelled', async () => {
      const draft = await service().createDraft(adjustmentInput({ adjustment_date: '2025-09-06', lines: increaseC() }), userId);
      await expect(service(branchUser(branchOne)).cancelDraft(draft.id, { reason: 'Not mine' }, userId))
        .rejects.toMatchObject({ statusCode: 403, message: 'You can only cancel Stock Adjustments for your own Branch.' });
      expect(await service(warehouseUser()).cancelDraft(draft.id, { reason: 'Counted twice' }, userId))
        .toEqual({ id: draft.id, adjustment_number: draft.adjustment_number, status: 'Voided' });
      const rows = await prisma.$queryRaw<{ status: string; void_reason: string; voided_at: Date | null }[]>`
        SELECT status, void_reason, voided_at FROM stock_adjustments WHERE id = CAST(${draft.id} AS uuid)
      `;
      expect(rows[0]).toMatchObject({ status: 'Voided', void_reason: 'Counted twice' });
      expect(rows[0].voided_at).not.toBeNull();
      await expect(service().post(draft.id, userId)).rejects.toThrow(/Only Draft Stock Adjustments can be posted/);
      await expect(service().updateDraft(draft.id, adjustmentInput({ adjustment_date: '2025-09-06', lines: increaseC() }), userId)).rejects.toThrow(/Only Draft Stock Adjustments can be changed/);
      await expect(service().cancelDraft(draft.id, { reason: 'Again' }, userId)).rejects.toThrow(/Only Draft Stock Adjustments can be cancelled/);
      expect(m.schema.CancelStockAdjustmentDraftInput.safeParse({}).success).toBe(false);
    });
  });
});
