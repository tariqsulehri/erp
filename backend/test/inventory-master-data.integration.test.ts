/**
 * Inventory and location master data tests against the real PostgreSQL database (TEST_DATABASE_URL, or
 * DATABASE_URL from .env): categories, units of measure, products, warehouses and locations, branches,
 * states, cities and areas. Everything happens inside new test companies that are deleted afterwards.
 */
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

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe.skipIf(!databaseUrl)('Inventory master data (database)', () => {
  let company: TestCompany;
  // A second test company, used only to prove that one company cannot change another company's rows.
  let otherCompany: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';

  let productSchemas: typeof import('../src/modules/inventory/product.schema.js');
  let warehouseSchemas: typeof import('../src/modules/inventory/warehouse.schema.js');
  let branchSchemas: typeof import('../src/modules/branches/branch.schema.js');
  let stateSchemas: typeof import('../src/modules/states/state.schema.js');
  let citySchemas: typeof import('../src/modules/cities/city.schema.js');
  let areaSchemas: typeof import('../src/modules/areas/area.schema.js');
  let ProductService: typeof import('../src/modules/inventory/product.service.js')['ProductService'];
  let products: InstanceType<typeof import('../src/modules/inventory/product.service.js')['ProductService']>;
  let warehouses: InstanceType<typeof import('../src/modules/inventory/warehouse.service.js')['WarehouseService']>;
  let branches: InstanceType<typeof import('../src/modules/branches/branch.service.js')['BranchService']>;
  let states: InstanceType<typeof import('../src/modules/states/state.service.js')['StateService']>;
  let cities: InstanceType<typeof import('../src/modules/cities/city.service.js')['CityService']>;
  let areas: InstanceType<typeof import('../src/modules/areas/area.service.js')['AreaService']>;

  const productInput = (body: Record<string, unknown>) => productSchemas.createProductSchema.parse({ product_type: 'Finished', ...body });

  /** Puts stock straight into the snapshot table so stock-based rules can be checked. */
  async function addStock(itemId: string, holder: { warehouseId?: string; branchId?: string; locationId?: string }, quantity: number) {
    return prisma.stockBalance.create({
      data: {
        companyId,
        itemId,
        warehouseId: holder.warehouseId ?? null,
        branchId: holder.branchId ?? null,
        locationId: holder.locationId ?? null,
        stockOnHand: quantity,
        availableStock: quantity,
        averageCost: 10,
        totalStockValue: quantity * 10,
      },
    });
  }

  beforeAll(async () => {
    company = await createTestCompany('Inventory Master Data');
    otherCompany = await createTestCompany('Inventory Master Data Other');
    prisma = company.prisma;
    companyId = company.companyId;

    productSchemas = await import('../src/modules/inventory/product.schema.js');
    warehouseSchemas = await import('../src/modules/inventory/warehouse.schema.js');
    branchSchemas = await import('../src/modules/branches/branch.schema.js');
    stateSchemas = await import('../src/modules/states/state.schema.js');
    citySchemas = await import('../src/modules/cities/city.schema.js');
    areaSchemas = await import('../src/modules/areas/area.schema.js');
    ProductService = (await import('../src/modules/inventory/product.service.js')).ProductService;
    products = new ProductService(companyId);
    warehouses = new (await import('../src/modules/inventory/warehouse.service.js')).WarehouseService(companyId);
    branches = new (await import('../src/modules/branches/branch.service.js')).BranchService(companyId);
    states = new (await import('../src/modules/states/state.service.js')).StateService(companyId);
    cities = new (await import('../src/modules/cities/city.service.js')).CityService(companyId);
    areas = new (await import('../src/modules/areas/area.service.js')).AreaService(companyId);
  }, 120000);

  afterAll(async () => {
    if (company) await company.cleanup();
    if (otherCompany) await otherCompany.cleanup();
    await prisma?.$disconnect();
  });

  describe('categories', () => {
    let rootId = '';
    let childId = '';

    it('builds a tree with level and path, and upper-cases codes', async () => {
      const root = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'elec', name: 'Electronics' }));
      const child = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'phone', name: 'Phones', parent_id: root.id }));
      const grandChild = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'smart', name: 'Smart Phones', parent_id: child.id }));
      rootId = root.id;
      childId = child.id;

      expect(root).toMatchObject({ code: 'ELEC', level: 0, path: root.id, parentId: null, isActive: true });
      expect(child).toMatchObject({ code: 'PHONE', level: 1, path: `${root.id}/${child.id}`, parentId: root.id });
      expect(grandChild).toMatchObject({ level: 2, path: `${root.id}/${child.id}/${grandChild.id}` });

      const listed = await products.listCategories();
      expect(listed.map(row => row.code)).toEqual(['ELEC', 'PHONE', 'SMART']);
      expect(listed.map(row => row.depth)).toEqual([0, 1, 2]);
    });

    it('requires code and name', () => {
      expect(productSchemas.createCategorySchema.safeParse({ code: ' ', name: 'X' }).success).toBe(false);
      expect(productSchemas.createCategorySchema.safeParse({ code: 'X', name: '' }).success).toBe(false);
    });

    it('rejects a duplicate code and an unknown parent', async () => {
      await expectBusinessError(products.createCategory(productSchemas.createCategorySchema.parse({ code: 'Elec', name: 'Again' })), 'Category Code "ELEC" already exists.');
      await expectBusinessError(products.createCategory(productSchemas.createCategorySchema.parse({ code: 'LOST', name: 'Lost', parent_id: MISSING_ID })), 'Parent Category not found.');
    });

    it('allows the same category code in another company', async () => {
      const other = new ProductService(otherCompany.companyId);
      const created = await other.createCategory(productSchemas.createCategorySchema.parse({ code: 'ELEC', name: 'Other Electronics' }));
      expect(created.companyId).toBe(otherCompany.companyId);
      expect((await products.listCategories()).every(row => row.company_id === companyId)).toBe(true);
    });

    it('stops nesting below 8 levels', async () => {
      let parentId: string | undefined;
      for (let level = 0; level <= 7; level += 1) {
        const created = await products.createCategory(productSchemas.createCategorySchema.parse({ code: `DEEP${level}`, name: `Deep ${level}`, parent_id: parentId }));
        expect(created.level).toBe(level);
        parentId = created.id;
      }
      await expectBusinessError(
        products.createCategory(productSchemas.createCategorySchema.parse({ code: 'DEEP8', name: 'Too Deep', parent_id: parentId })),
        'This Category already has the most levels allowed. You cannot add a level under it.',
      );
    });

    it('updates a category and checks code, parent and existence', async () => {
      const updated = await products.updateCategory(productSchemas.updateCategorySchema.parse({ id: childId, name: 'Mobile Phones', is_active: false }));
      expect(updated).toMatchObject({ name: 'Mobile Phones', code: 'PHONE', isActive: false });
      await expectBusinessError(products.updateCategory(productSchemas.updateCategorySchema.parse({ id: childId, code: 'elec' })), 'Category Code "ELEC" is already used.');
      await expectBusinessError(products.updateCategory({ id: childId, parent_id: childId }), 'A Category cannot be its own parent.');
      await expectBusinessError(products.updateCategory({ id: MISSING_ID, name: 'Ghost' }), 'Category not found.', 404);
    });

    it('blocks deleting a category with sub-categories or products, and deletes an empty one', async () => {
      await expectBusinessError(products.deleteCategory(rootId), 'This Category cannot be deleted. It has 1 Sub Category.');

      const used = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'USED', name: 'Used Category' }));
      await products.create(productInput({ sku: 'CAT-ITEM-1', name: 'Category Item', category_id: used.id }));
      await expectBusinessError(products.deleteCategory(used.id), 'This Category cannot be deleted. 1 product(s) use it.');

      const empty = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'EMPTY', name: 'Empty Category' }));
      await products.deleteCategory(empty.id);
      expect(await prisma.inventoryCategory.count({ where: { id: empty.id } })).toBe(0);
    });

    // BUG: ProductService.updateCategory (src/modules/inventory/product.service.ts) saves a new parent_id but
    // never recalculates `level` and `path`, so a moved category (and its children) keeps the old tree position
    // and listCategories (ordered by path) shows it under the old parent.
    it('recalculates level and path when a category is moved to another parent', async () => {
      const toys = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'TOYS', name: 'Toys' }));
      const games = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'GAMES', name: 'Games' }));
      const moved = await products.updateCategory({ id: games.id, parent_id: toys.id });
      expect(moved.level).toBe(1);
      expect(moved.path).toBe(`${toys.path}/${games.id}`);
    });

    // BUG: updateCategory only stops a category from being its own parent. Moving a category under one of its
    // own descendants is accepted and creates a loop in the tree (A -> B -> A).
    it('rejects moving a category under its own descendant', async () => {
      const parent = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'LOOPA', name: 'Loop A' }));
      const child = await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'LOOPB', name: 'Loop B', parent_id: parent.id }));
      await expect(products.updateCategory({ id: parent.id, parent_id: child.id })).rejects.toThrow();
    });

    // BUG: ProductService.deleteCategory counts products and children only inside the caller's company, then
    // runs `prisma.inventoryCategory.delete({ where: { id } })` without a company filter. A user of one company
    // can delete another company's category by id. It should answer "Category not found." (404) instead.
    it('does not delete a category that belongs to another company', async () => {
      const other = new ProductService(otherCompany.companyId);
      const foreign = await other.createCategory(productSchemas.createCategorySchema.parse({ code: 'FOREIGN', name: 'Foreign Category' }));
      await products.deleteCategory(foreign.id).catch(() => undefined);
      expect(await prisma.inventoryCategory.count({ where: { id: foreign.id } })).toBe(1);
    });
  });

  describe('units of measure', () => {
    let pieceId = '';
    let boxId = '';

    it('creates units, keeps one default and maps the unit type for display', async () => {
      const piece = await products.createUom(productSchemas.createUomSchema.parse({ name: 'Piece', abbreviation: 'pcs', uom_type: 'Quantity', is_default: true }));
      const box = await products.createUom(productSchemas.createUomSchema.parse({ name: 'Box', abbreviation: 'box', uom_type: 'Quantity' }));
      const kilo = await products.createUom(productSchemas.createUomSchema.parse({ name: 'Kilogram', abbreviation: 'kg', uom_type: 'Weight', is_default: true }));
      pieceId = piece.id;
      boxId = box.id;

      expect(piece).toMatchObject({ code: 'PCS', shortName: 'pcs', isActive: true });
      const listed = await products.listUom();
      expect(listed.map(row => row.name)).toEqual(['Box', 'Kilogram', 'Piece']);
      expect(listed.filter(row => row.is_default).map(row => row.id)).toEqual([kilo.id]);
      expect(listed.find(row => row.id === kilo.id)?.uom_type).toBe('Weight');
      expect(listed.find(row => row.id === box.id)?.uom_type).toBe('Other');
    });

    it('rejects a duplicate abbreviation and an empty name', async () => {
      await expectBusinessError(products.createUom(productSchemas.createUomSchema.parse({ name: 'Pieces', abbreviation: 'pcs', uom_type: 'Quantity' })), 'UOM Abbreviation "pcs" already exists.');
      expect(productSchemas.createUomSchema.safeParse({ name: '', abbreviation: 'x', uom_type: 'Quantity' }).success).toBe(false);
      expect(productSchemas.createUomSchema.safeParse({ name: 'X', abbreviation: 'x', uom_type: 'Speed' }).success).toBe(false);
    });

    it('moves the default flag on update and refuses an abbreviation that is already used', async () => {
      const updated = await products.updateUom({ id: pieceId, is_default: true, name: 'Single Piece' });
      expect(updated).toMatchObject({ isDefault: true, name: 'Single Piece' });
      expect(await prisma.unitOfMeasure.count({ where: { companyId, isDefault: true } })).toBe(1);

      await expect(products.updateUom({ id: boxId, abbreviation: 'pcs' })).rejects.toThrow();
      expect((await prisma.unitOfMeasure.findUniqueOrThrow({ where: { id: boxId } })).shortName).toBe('box');
      await expectBusinessError(products.updateUom({ id: MISSING_ID, name: 'Ghost' }), 'UOM not found.', 404);
    });

    it('blocks deleting a unit used by a product and deletes an unused one', async () => {
      await products.create(productInput({ sku: 'UOM-ITEM-1', name: 'Unit Item', uom_id: boxId }));
      await expectBusinessError(products.deleteUom(boxId), 'This UOM cannot be deleted. 1 product(s) use it.');

      const spare = await products.createUom(productSchemas.createUomSchema.parse({ name: 'Dozen', abbreviation: 'dz', uom_type: 'Quantity' }));
      await products.deleteUom(spare.id);
      expect(await prisma.unitOfMeasure.count({ where: { id: spare.id } })).toBe(0);
    });

    // BUG: ProductService.deleteUom checks product usage inside the caller's company but deletes with
    // `prisma.unitOfMeasure.delete({ where: { id } })` (no company filter), so another company's unit can be deleted.
    it('does not delete a unit of measure that belongs to another company', async () => {
      const other = new ProductService(otherCompany.companyId);
      const foreign = await other.createUom(productSchemas.createUomSchema.parse({ name: 'Foreign Unit', abbreviation: 'fu', uom_type: 'Other' }));
      await products.deleteUom(foreign.id).catch(() => undefined);
      expect(await prisma.unitOfMeasure.count({ where: { id: foreign.id } })).toBe(1);
    });
  });

  describe('products', () => {
    let categoryId = '';
    let uomId = '';
    let productId = '';

    beforeAll(async () => {
      categoryId = (await products.createCategory(productSchemas.createCategorySchema.parse({ code: 'GROC', name: 'Grocery' }))).id;
      uomId = (await products.createUom(productSchemas.createUomSchema.parse({ name: 'Packet', abbreviation: 'pkt', uom_type: 'Quantity' }))).id;
    });

    it('validates required fields and limits in the schema', () => {
      expect(productSchemas.createProductSchema.safeParse({ sku: 'X', name: 'X' }).success).toBe(false); // product_type required
      expect(productSchemas.createProductSchema.safeParse({ sku: '', name: 'X', product_type: 'Finished' }).success).toBe(false);
      expect(productSchemas.createProductSchema.safeParse({ sku: 'X', name: 'X', product_type: 'Finished', tax_rate: 101 }).success).toBe(false);
      expect(productSchemas.createProductSchema.safeParse({ sku: 'X', name: 'X', product_type: 'Finished', sale_price: -1 }).success).toBe(false);
    });

    it('suggests the next SKU from existing SKUs', async () => {
      expect(await products.suggestSku('PRD')).toBe('PRD-0001');
      await products.create(productInput({ sku: 'PRD-0007', name: 'Seed Product' }));
      expect(await products.suggestSku('PRD')).toBe('PRD-0008');
    });

    it('creates a product with category, unit, prices, barcode and stock levels', async () => {
      const created = await products.create(productInput({
        sku: 'TEA-001', name: 'Green Tea 100g', description: 'Loose leaf', category_id: categoryId, uom_id: uomId,
        cost_price: 120.5, sale_price: 180, min_sale_price: 150, tax_rate: 17, min_stock_level: 10, max_stock_level: 100,
        reorder_qty: 20, barcode: ' 8961234567890 ', notes: 'Keep dry',
      }));
      productId = created.id;

      expect(created).toMatchObject({
        sku: 'TEA-001', name: 'Green Tea 100g', description: 'Loose leaf', barcode: '8961234567890', category_id: categoryId, uom_id: uomId,
        product_type: 'Finished', status: 'Active', is_sellable: true, is_purchasable: true, track_inventory: true, notes: 'Keep dry',
        category: { id: categoryId, code: 'GROC', name: 'Grocery' },
        uom: { id: uomId, abbreviation: 'pkt', name: 'Packet' },
      });
      expect(Number(created.cost_price)).toBe(120.5);
      expect(Number(created.sale_price)).toBe(180);
      expect(Number(created.min_sale_price)).toBe(150);
      expect(Number(created.tax_rate)).toBe(17);
      expect(Number(created.min_stock_level)).toBe(10);
      expect(Number(created.max_stock_level)).toBe(100);
      expect(Number(created.reorder_qty)).toBe(20);
      expect(Number(created.qty_on_hand)).toBe(0);

      const row = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: productId } });
      expect(row).toMatchObject({ itemCode: 'TEA-001', sku: 'TEA-001', baseUomId: uomId, stockUomId: uomId, purchaseUomId: uomId, salesUomId: uomId, itemKind: 'FINISHED_GOOD', isServiceItem: false });
    });

    it('maps product types and statuses to item flags', async () => {
      const service = await products.create(productInput({ sku: 'SRV-001', name: 'Installation', product_type: 'Service', track_inventory: false }));
      expect(service).toMatchObject({ product_type: 'Service', track_inventory: false });
      expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: service.id } })).isServiceItem).toBe(true);

      const inactive = await products.create(productInput({ sku: 'OLD-001', name: 'Old Stock', status: 'Inactive' }));
      expect(inactive.status).toBe('Inactive');
      const discontinued = await products.create(productInput({ sku: 'DIS-001', name: 'Discontinued Line', status: 'Discontinued', product_type: 'RawMaterial' }));
      expect(discontinued).toMatchObject({ status: 'Discontinued', product_type: 'RawMaterial' });
      expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: discontinued.id } })).toMatchObject({ isActive: true, isBlocked: true });
    });

    it('rejects a duplicate SKU and a minimum stock level that is not below the maximum', async () => {
      await expectBusinessError(products.create(productInput({ sku: 'TEA-001', name: 'Copy' })), 'SKU "TEA-001" already exists in this company.');
      await expectBusinessError(products.create(productInput({ sku: 'LVL-001', name: 'Levels', min_stock_level: 50, max_stock_level: 50 })), 'Minimum Stock Level must be less than Maximum Stock Level.');
      expect(await prisma.inventoryItem.count({ where: { companyId, sku: 'LVL-001' } })).toBe(0);
    });

    it('updates fields, replaces the barcode and checks levels against saved values', async () => {
      const updated = await products.update({ id: productId, name: 'Green Tea 200g', sale_price: 300, barcode: '8960000000001' });
      expect(updated).toMatchObject({ name: 'Green Tea 200g', barcode: '8960000000001', sku: 'TEA-001' });
      expect(Number(updated.sale_price)).toBe(300);
      expect(Number(updated.cost_price)).toBe(120.5);
      const barcodes = await prisma.itemBarcode.findMany({ where: { companyId, itemId: productId }, orderBy: { createdAt: 'asc' } });
      expect(barcodes.map(row => [row.barcode, row.isActive])).toEqual([['8961234567890', false], ['8960000000001', true]]);

      // Saved maximum is 100, so a minimum of 100 must be refused even though only the minimum is sent.
      await expectBusinessError(products.update({ id: productId, min_stock_level: 100 }), 'Minimum Stock Level must be less than Maximum Stock Level.');
      await expectBusinessError(products.update({ id: productId, sku: 'SRV-001' }), 'SKU "SRV-001" is already used.');
      await expectBusinessError(products.update({ id: MISSING_ID, name: 'Ghost' }), 'Product not found.', 404);
      expect(await products.getById(MISSING_ID)).toBeNull();
    });

    it('archives as Discontinued and only permanently deletes Inactive products', async () => {
      const archived = await products.create(productInput({ sku: 'ARC-001', name: 'To Archive' }));
      await products.archive(archived.id);
      expect((await products.getById(archived.id)).status).toBe('Discontinued');
      await expectBusinessError(products.archive(MISSING_ID), 'Product not found.', 404);

      await expectBusinessError(products.delete(productId), 'Only Inactive products can be deleted for good. Use Archive to mark a product as Discontinued.');
      const inactive = await prisma.inventoryItem.findFirstOrThrow({ where: { companyId, sku: 'OLD-001' } });
      await products.delete(inactive.id);
      expect(await prisma.inventoryItem.count({ where: { id: inactive.id } })).toBe(0);
      await expectBusinessError(products.delete(MISSING_ID), 'Product not found.', 404);
    });

    it('lists with search (including barcode), filters, sorting and pagination', async () => {
      const query = (body: Record<string, unknown>) => productSchemas.listProductsQuery.parse(body);

      const byBarcode = await products.list(query({ search: '8960000000001' }));
      expect(byBarcode.data.map(row => row.sku)).toEqual(['TEA-001']);
      expect(byBarcode.pagination).toEqual({ total: 1, page: 1, limit: 50, pages: 1 });

      const byCategory = await products.list(query({ category_id: categoryId }));
      expect(byCategory.data.map(row => row.sku)).toEqual(['TEA-001']);

      const services = await products.list(query({ product_type: 'Service' }));
      expect(services.data.map(row => row.sku)).toEqual(['SRV-001']);

      const discontinued = await products.list(query({ status: 'Discontinued' }));
      expect(discontinued.data.map(row => row.sku).sort()).toEqual(['ARC-001', 'DIS-001']);
      const active = await products.list(query({ status: 'Active', limit: 200 }));
      expect(active.data.every(row => row.status === 'Active')).toBe(true);

      const all = await products.list(query({ sort_by: 'sku', sort_dir: 'DESC', limit: 200 }));
      const skus = all.data.map(row => row.sku);
      expect(skus).toEqual([...skus].sort().reverse());
      const pageTwo = await products.list(query({ sort_by: 'sku', sort_dir: 'DESC', limit: 2, page: 2 }));
      expect(pageTwo.data.map(row => row.sku)).toEqual(skus.slice(2, 4));
      expect(pageTwo.pagination.pages).toBe(Math.ceil(all.pagination.total / 2));
    });

    it('uses stock balances for quantity, low stock and out of stock filters', async () => {
      const warehouse = await warehouses.create(warehouseSchemas.createWarehouseSchema.parse({ code: 'STOCKWH', name: 'Stock Check Warehouse' }));
      await addStock(productId, { warehouseId: warehouse.id }, 4); // minimum is 10

      const item = await products.getById(productId);
      expect(Number(item.qty_on_hand)).toBe(4);

      const query = (body: Record<string, unknown>) => productSchemas.listProductsQuery.parse({ limit: 200, ...body });
      expect((await products.list(query({ low_stock: 'true' }))).data.map(row => row.sku)).toEqual(['TEA-001']);
      expect((await products.list(query({ stock_filter: 'below_minimum' }))).data.map(row => row.sku)).toEqual(['TEA-001']);
      expect((await products.list(query({ stock_filter: 'at_or_below_reorder' }))).data.map(row => row.sku)).toEqual(['TEA-001']);
      const outOfStock = (await products.list(query({ stock_filter: 'out_of_stock' }))).data.map(row => row.sku);
      expect(outOfStock).not.toContain('TEA-001');
      expect(outOfStock).toContain('SRV-001');
    });
  });

  describe('branches', () => {
    let mainId = '';
    let cityBranchId = '';

    it('makes the first branch the default and moves the default when asked', async () => {
      const main = await branches.create(branchSchemas.createBranchSchema.parse({ code: 'main', name: 'Main Branch', email: '', city: 'Lahore' }));
      expect(main).toMatchObject({ code: 'MAIN', is_default: true, is_active: true, email: null, city: 'Lahore' });
      mainId = main.id;

      const cityBranch = await branches.create(branchSchemas.createBranchSchema.parse({ code: 'CITY', name: 'City Branch', manager_name: 'Ali Raza' }));
      expect(cityBranch.is_default).toBe(false);
      cityBranchId = cityBranch.id;

      const switched = await branches.update({ id: cityBranchId, is_default: true });
      expect(switched.is_default).toBe(true);
      expect((await branches.getById(mainId))?.is_default).toBe(false);
      await branches.update({ id: mainId, is_default: true });
      expect(await prisma.branch.count({ where: { companyId, isDefault: true } })).toBe(1);
    });

    it('validates required fields and email, and rejects duplicate codes', async () => {
      expect(branchSchemas.createBranchSchema.safeParse({ code: '', name: 'X' }).success).toBe(false);
      expect(branchSchemas.createBranchSchema.safeParse({ code: 'X', name: 'X', email: 'wrong' }).success).toBe(false);
      await expectBusinessError(branches.create(branchSchemas.createBranchSchema.parse({ code: 'Main', name: 'Copy' })), 'Branch Code is already used.');
      await expectBusinessError(branches.update({ id: cityBranchId, code: 'MAIN' }), 'Branch Code is already used.');
      await expectBusinessError(branches.update({ id: MISSING_ID, name: 'Ghost' }), 'Branch not found.', 404);
    });

    it('does not make the default branch or a branch with stock inactive', async () => {
      await expectBusinessError(branches.update({ id: mainId, is_active: false }), 'Default Branch cannot be made Inactive. Select another default branch first.');

      const item = await products.create(productInput({ sku: 'BR-STOCK-1', name: 'Branch Stock Item' }));
      const balance = await addStock(item.id, { branchId: cityBranchId }, 3);
      await expectBusinessError(branches.update({ id: cityBranchId, is_active: false }), 'Branch has stock on hand and cannot be made Inactive. Transfer or adjust the stock first.');

      await prisma.stockBalance.update({ where: { id: balance.id }, data: { stockOnHand: 0, availableStock: 0 } });
      expect((await branches.update({ id: cityBranchId, is_active: false })).is_active).toBe(false);
    });

    it('lists with status filter, search and active warehouse count', async () => {
      await warehouses.create(warehouseSchemas.createWarehouseSchema.parse({ code: 'MAINWH', name: 'Main Branch Store', branch_id: mainId }));
      const inactive = await branches.list(branchSchemas.listBranchesQuery.parse({ status: 'Inactive' }));
      expect(inactive.data.map(row => row.code)).toEqual(['CITY']);
      const search = await branches.list(branchSchemas.listBranchesQuery.parse({ search: 'ali raza' }));
      expect(search.data.map(row => row.code)).toEqual(['CITY']);
      const all = await branches.list(branchSchemas.listBranchesQuery.parse({}));
      expect(all.data[0]).toMatchObject({ code: 'MAIN', is_default: true, active_warehouse_count: 1 });
    });

    // BUG: BranchService.update (src/modules/branches/branch.service.ts) refuses to make the default branch inactive,
    // but it lets an inactive branch become the default (is_default: true is saved without checking is_active),
    // which leaves the company with an inactive default branch.
    it('does not make an inactive branch the default', async () => {
      await expect(branches.update({ id: cityBranchId, is_default: true })).rejects.toThrow();
    });
  });

  describe('warehouses and locations', () => {
    let firstWarehouseId = '';
    let mainWarehouseId = '';
    let itemId = '';
    let activeBranchId = '';

    beforeAll(async () => {
      const list = await warehouses.list(warehouseSchemas.listWarehousesQuery.parse({ limit: 200 }));
      firstWarehouseId = list.data.find(row => row.code === 'STOCKWH')!.id;
      itemId = (await products.create(productInput({ sku: 'WH-STOCK-1', name: 'Warehouse Stock Item' }))).id;
      activeBranchId = (await prisma.branch.findFirstOrThrow({ where: { companyId, code: 'MAIN' } })).id;
    });

    it('made the first warehouse of the company the default', async () => {
      const first = await warehouses.getById(firstWarehouseId);
      expect(first).toMatchObject({ code: 'STOCKWH', is_default: true, use_locations: false });
    });

    it('creates a warehouse with an active branch and moves the default flag', async () => {
      const created = await warehouses.create(warehouseSchemas.createWarehouseSchema.parse({
        code: 'central', name: 'Central Warehouse', branch_id: activeBranchId, address: ' Plot 1 ', description: '', is_default: true, use_locations: true,
      }));
      mainWarehouseId = created.id;
      expect(created).toMatchObject({ code: 'CENTRAL', branch_id: activeBranchId, address: 'Plot 1', description: null, is_default: true, use_locations: true });
      expect((await warehouses.getById(firstWarehouseId))?.is_default).toBe(false);
      expect(await prisma.warehouse.count({ where: { companyId, isDefault: true } })).toBe(1);
    });

    it('rejects duplicate codes, inactive or unknown branches, and missing names', async () => {
      await expectBusinessError(warehouses.create(warehouseSchemas.createWarehouseSchema.parse({ code: 'Central', name: 'Copy' })), 'Warehouse Code is already used.');
      const inactiveBranch = await prisma.branch.findFirstOrThrow({ where: { companyId, code: 'CITY' } });
      await expectBusinessError(warehouses.create(warehouseSchemas.createWarehouseSchema.parse({ code: 'CITYWH', name: 'City Store', branch_id: inactiveBranch.id })), 'Please select an Active Branch.');
      await expectBusinessError(warehouses.update({ id: firstWarehouseId, branch_id: MISSING_ID }), 'Please select an Active Branch.');
      await expectBusinessError(warehouses.update({ id: firstWarehouseId, code: 'CENTRAL' }), 'Warehouse Code is already used.');
      await expectBusinessError(warehouses.update({ id: MISSING_ID, name: 'Ghost' }), 'Warehouse not found.', 404);
      expect(warehouseSchemas.createWarehouseSchema.safeParse({ code: 'X', name: ' ' }).success).toBe(false);
    });

    it('does not make the default warehouse or a warehouse with stock inactive', async () => {
      await expectBusinessError(warehouses.update({ id: mainWarehouseId, is_active: false }), 'Default Warehouse cannot be made Inactive. Select another default warehouse first.');

      // STOCKWH holds stock from the product tests.
      await expectBusinessError(warehouses.update({ id: firstWarehouseId, is_active: false }), 'Warehouse has stock on hand and cannot be made Inactive.');

      const empty = await warehouses.create(warehouseSchemas.createWarehouseSchema.parse({ code: 'EMPTYWH', name: 'Empty Warehouse' }));
      expect((await warehouses.update({ id: empty.id, is_active: false })).is_active).toBe(false);
    });

    it('only changes Use Locations when no stock would be left in the wrong place', async () => {
      // STOCKWH has stock without a location, so locations cannot be turned on.
      await expectBusinessError(
        warehouses.update({ id: firstWarehouseId, use_locations: true }),
        'Warehouse has stock without Location. Move or adjust stock before enabling Locations.',
      );

      // CENTRAL uses locations and has stock in a location, so locations cannot be turned off.
      const bin = await warehouses.createLocation(mainWarehouseId, warehouseSchemas.createWarehouseLocationSchema.parse({ code: 'a-01', name: 'Aisle 1' }));
      await addStock(itemId, { warehouseId: mainWarehouseId, locationId: bin.id }, 7);
      await expectBusinessError(
        warehouses.update({ id: mainWarehouseId, use_locations: false }),
        'Warehouse has stock in Locations. Move or adjust stock before disabling Locations.',
      );

      // A warehouse without stock can switch freely.
      const fresh = await warehouses.create(warehouseSchemas.createWarehouseSchema.parse({ code: 'FRESHWH', name: 'Fresh Warehouse' }));
      expect((await warehouses.update({ id: fresh.id, use_locations: true })).use_locations).toBe(true);
      expect((await warehouses.update({ id: fresh.id, use_locations: false })).use_locations).toBe(false);
    });

    it('manages locations: first is default, codes unique per warehouse, default and stocked locations stay active', async () => {
      const locations = await warehouses.listLocations(mainWarehouseId);
      expect(locations).toHaveLength(1);
      expect(locations[0]).toMatchObject({ code: 'A-01', is_default: true, is_active: true });
      const firstBinId = locations[0].id;

      const second = await warehouses.createLocation(mainWarehouseId, warehouseSchemas.createWarehouseLocationSchema.parse({ code: 'B-01', name: 'Aisle 2' }));
      expect(second.is_default).toBe(false);
      await expectBusinessError(
        warehouses.createLocation(mainWarehouseId, warehouseSchemas.createWarehouseLocationSchema.parse({ code: 'a-01', name: 'Copy' })),
        'Location Code is already used in this warehouse.',
      );
      // The same code is fine in another warehouse.
      const elsewhere = await warehouses.createLocation(firstWarehouseId, warehouseSchemas.createWarehouseLocationSchema.parse({ code: 'A-01', name: 'Other Aisle' }));
      expect(elsewhere.warehouse_id).toBe(firstWarehouseId);

      await expectBusinessError(warehouses.updateLocation({ id: firstBinId, is_active: false }), 'Default Location cannot be made Inactive. Select another default location first.');
      const moved = await warehouses.updateLocation({ id: second.id, is_default: true });
      expect(moved.is_default).toBe(true);
      expect((await warehouses.listLocations(mainWarehouseId)).filter(row => row.is_default).map(row => row.id)).toEqual([second.id]);

      // A-01 is no longer default but still holds 7 units.
      await expectBusinessError(warehouses.updateLocation({ id: firstBinId, is_active: false }), 'Warehouse Location has stock on hand and cannot be made Inactive.');
      await expectBusinessError(warehouses.updateLocation({ id: second.id, code: 'A-01' }), 'Location Code is already used in this warehouse.');
      await expectBusinessError(warehouses.updateLocation({ id: MISSING_ID, name: 'Ghost' }), 'Warehouse Location not found.', 404);
      await expectBusinessError(warehouses.listLocations(MISSING_ID), 'Warehouse not found.', 404);

      const detail = await warehouses.getById(mainWarehouseId);
      expect(detail?.locations.map(row => row.code)).toEqual(['B-01', 'A-01']);
    });

    it('lists warehouses with status filter, search and stock totals', async () => {
      const inactive = await warehouses.list(warehouseSchemas.listWarehousesQuery.parse({ status: 'Inactive' }));
      expect(inactive.data.map(row => row.code)).toEqual(['EMPTYWH']);

      const central = await warehouses.list(warehouseSchemas.listWarehousesQuery.parse({ search: 'plot 1' }));
      expect(central.data).toHaveLength(1);
      expect(central.data[0]).toMatchObject({ code: 'CENTRAL', is_default: true, stock_item_count: 1, branch: { id: activeBranchId, code: 'MAIN' } });
      expect(Number(central.data[0].stock_on_hand)).toBe(7);
      expect(Number(central.data[0].total_stock_value)).toBe(70);

      const all = await warehouses.list(warehouseSchemas.listWarehousesQuery.parse({}));
      expect(all.data[0].code).toBe('CENTRAL'); // default first
    });
  });

  describe('states, cities and areas', () => {
    let punjabId = '';
    let sindhId = '';
    let lahoreId = '';

    it('creates states, rejects duplicate names and filters by status', async () => {
      punjabId = (await states.create(stateSchemas.createStateSchema.parse({ name: ' Punjab ' }))).id;
      sindhId = (await states.create(stateSchemas.createStateSchema.parse({ name: 'Sindh' }))).id;
      await states.create(stateSchemas.createStateSchema.parse({ name: 'Old Province', is_active: false }));

      expect((await states.getById(punjabId))?.name).toBe('Punjab');
      await expectBusinessError(states.create(stateSchemas.createStateSchema.parse({ name: 'Punjab' })), 'State Name is already used.');
      await expectBusinessError(states.update({ id: sindhId, name: 'Punjab' }), 'State Name is already used.');
      await expectBusinessError(states.update({ id: MISSING_ID, name: 'Ghost' }), 'State not found.', 404);
      expect(stateSchemas.createStateSchema.safeParse({ name: '' }).success).toBe(false);

      const inactive = await states.list(stateSchemas.listStatesQuery.parse({ status: 'Inactive' }));
      expect(inactive.data.map(row => row.name)).toEqual(['Old Province']);
    });

    it('creates cities inside an existing state with names unique per state', async () => {
      const lahore = await cities.create(citySchemas.createCitySchema.parse({ name: 'Lahore', state_id: punjabId }));
      lahoreId = lahore.id;
      expect(lahore).toMatchObject({ name: 'Lahore', state_id: punjabId, state_name: 'Punjab', is_active: true });

      await expectBusinessError(cities.create(citySchemas.createCitySchema.parse({ name: 'Lahore', state_id: punjabId })), 'City Name is already used in this State.');
      // The same name is allowed in another state.
      const sindhLahore = await cities.create(citySchemas.createCitySchema.parse({ name: 'Lahore', state_id: sindhId }));
      expect(sindhLahore.state_name).toBe('Sindh');
      // Moving it into a state that already has that name is refused.
      await expectBusinessError(cities.update({ id: sindhLahore.id, state_id: punjabId }), 'City Name is already used in this State.');
      await expectBusinessError(cities.create(citySchemas.createCitySchema.parse({ name: 'Nowhere', state_id: MISSING_ID })), 'Selected State does not exist.');
      await expectBusinessError(cities.update({ id: lahoreId, state_id: MISSING_ID }), 'Selected State does not exist.');
      expect(citySchemas.createCitySchema.safeParse({ name: 'X' }).success).toBe(false);

      const karachi = await cities.update({ id: sindhLahore.id, name: 'Karachi' });
      expect(karachi).toMatchObject({ name: 'Karachi', state_id: sindhId });
    });

    it('does not use a state from another company', async () => {
      const otherStates = new (await import('../src/modules/states/state.service.js')).StateService(otherCompany.companyId);
      const foreignState = await otherStates.create(stateSchemas.createStateSchema.parse({ name: 'Foreign State' }));
      await expectBusinessError(cities.create(citySchemas.createCitySchema.parse({ name: 'Foreign City', state_id: foreignState.id })), 'Selected State does not exist.');
      expect(await states.getById(foreignState.id)).toBeNull();
    });

    it('does not make a state inactive while it has active cities', async () => {
      await expectBusinessError(states.update({ id: punjabId, is_active: false }), 'State has active Cities and cannot be made Inactive.');
      const list = await states.list(stateSchemas.listStatesQuery.parse({ search: 'punj' }));
      expect(list.data).toEqual([expect.objectContaining({ name: 'Punjab', active_city_count: 1 })]);
    });

    it('creates areas inside an existing city with names unique per city', async () => {
      const gulberg = await areas.create(areaSchemas.createAreaSchema.parse({ name: 'Gulberg', city_id: lahoreId }));
      expect(gulberg).toMatchObject({ name: 'Gulberg', city_id: lahoreId, city_name: 'Lahore', state_id: punjabId, state_name: 'Punjab' });

      await expectBusinessError(areas.create(areaSchemas.createAreaSchema.parse({ name: 'Gulberg', city_id: lahoreId })), 'Area Name is already used in this City.');
      await expectBusinessError(areas.create(areaSchemas.createAreaSchema.parse({ name: 'Nowhere', city_id: MISSING_ID })), 'Selected City does not exist.');
      const dha = await areas.create(areaSchemas.createAreaSchema.parse({ name: 'DHA', city_id: lahoreId }));
      await expectBusinessError(areas.update({ id: dha.id, name: 'Gulberg' }), 'Area Name is already used in this City.');
      await expectBusinessError(areas.update({ id: MISSING_ID, name: 'Ghost' }), 'Area not found.', 404);

      const inactiveDha = await areas.update({ id: dha.id, is_active: false });
      expect(inactiveDha.is_active).toBe(false);

      const lahoreAreas = await areas.list(areaSchemas.listAreasQuery.parse({ city_id: lahoreId }));
      expect(lahoreAreas.data.map(row => row.name)).toEqual(['DHA', 'Gulberg']);
      const activeAreas = await areas.list(areaSchemas.listAreasQuery.parse({ status: 'Active' }));
      expect(activeAreas.data.map(row => row.name)).toEqual(['Gulberg']);
    });

    it('does not make a city inactive while it has active areas, and allows it afterwards', async () => {
      await expectBusinessError(cities.update({ id: lahoreId, is_active: false }), 'City has active Areas and cannot be made Inactive.');
      const cityList = await cities.list(citySchemas.listCitiesQuery.parse({ state_id: punjabId }));
      expect(cityList.data).toEqual([expect.objectContaining({ name: 'Lahore', active_area_count: 1 })]);

      const gulberg = (await areas.list(areaSchemas.listAreasQuery.parse({ search: 'gulb' }))).data[0];
      await areas.update({ id: gulberg.id, is_active: false });
      expect((await cities.update({ id: lahoreId, is_active: false })).is_active).toBe(false);
      // With no active city left, the state can be made inactive too.
      expect((await states.update({ id: punjabId, is_active: false })).is_active).toBe(false);
    });
  });
});
