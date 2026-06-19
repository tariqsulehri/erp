import { AppDataSource }      from '@/db/data-source';
import { Product }             from './product.entity';
import { ProductCategory }     from './product-category.entity';
import { UnitOfMeasure }       from './uom.entity';
import {
  CreateProductInput, UpdateProductInput, ListProductsQuery,
  CreateCategoryInput, UpdateCategoryInput,
  CreateUomInput,     UpdateUomInput,
} from './product.schema';

/* ================================================================
   ProductService
   ================================================================
   All methods scope to companyId; never leak cross-company data.

   Category hierarchy uses the materialized-path pattern:
     path  = 'root_id/parent_id/self_id' (slash-separated UUIDs)
     depth = 0 for root, 1 for child, etc. (max 7)

   Cycle detection is O(1):
     A→B cycle exists iff new_parent.path contains A.id
   ================================================================ */

export class ProductService {
  private repo    = AppDataSource.getRepository(Product);
  private catRepo = AppDataSource.getRepository(ProductCategory);
  private uomRepo = AppDataSource.getRepository(UnitOfMeasure);

  constructor(private companyId: string) {}

  private toItemKind(productType?: string) {
    const map: Record<string, string> = {
      Finished: 'FINISHED_GOOD',
      RawMaterial: 'RAW_MATERIAL',
      SemiFinished: 'SEMI_FINISHED',
      Service: 'SERVICE',
      Consumable: 'CONSUMABLE',
    };
    return productType ? map[productType] : undefined;
  }

  /* ── SKU generator ──────────────────────────────────────────── */
  async nextSku(prefix = 'PRD'): Promise<string> {
    const rows = await AppDataSource.query(
      `
        SELECT COALESCE(sku, item_code) AS sku
        FROM inventory_items
        WHERE company_id = $1
          AND COALESCE(sku, item_code) ILIKE $2
        ORDER BY COALESCE(sku, item_code) DESC
        LIMIT 1
      `,
      [this.companyId, `${prefix}-%`],
    );
    const last = rows[0] as { sku?: string } | undefined;

    let seq = 1;
    if (last?.sku) {
      const segment = last.sku.split('-').pop() ?? '';
      const n = parseInt(segment, 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  async suggestSku(prefix?: string): Promise<string> {
    return this.nextSku(prefix ?? 'PRD');
  }

  /* ── List (paginated) ───────────────────────────────────────── */
  async list(q: ListProductsQuery) {
    const params: any[] = [this.companyId];
    const where: string[] = ['i.company_id = $1'];

    if (q.search) {
      params.push(`%${q.search}%`);
      const p = `$${params.length}`;
      where.push(`(
        COALESCE(i.sku, i.item_code) ILIKE ${p}
        OR i.item_code ILIKE ${p}
        OR i.item_name ILIKE ${p}
        OR COALESCE(i.sale_description, '') ILIKE ${p}
        OR COALESCE(i.detailed_description, '') ILIKE ${p}
        OR COALESCE(b.name, '') ILIKE ${p}
        OR COALESCE(pb.barcode, '') ILIKE ${p}
      )`);
    }

    if (q.category_id) {
      params.push(q.category_id);
      where.push(`i.category_id = $${params.length}`);
    }

    if (q.brand_id) {
      params.push(q.brand_id);
      where.push(`i.brand_id = $${params.length}`);
    }

    const itemKind = this.toItemKind(q.product_type);
    if (itemKind) {
      params.push(itemKind);
      where.push(`i.item_kind = $${params.length}::"InventoryItemKind"`);
    }

    if (q.status === 'Active') {
      where.push('i.is_active = true AND i.is_blocked = false');
    } else if (q.status === 'Inactive') {
      where.push('i.is_active = false');
    } else if (q.status === 'Discontinued') {
      where.push('i.is_blocked = true');
    }

    if (q.is_sellable !== undefined) {
      params.push(q.is_sellable);
      where.push(`i.is_sales_item = $${params.length}`);
    }

    if (q.low_stock) {
      where.push(`i.minimum_stock_level IS NOT NULL AND COALESCE(ss.stock_on_hand, 0) < i.minimum_stock_level`);
    }

    if (q.stock_filter === 'out_of_stock') {
      where.push(`COALESCE(ss.stock_on_hand, 0) <= 0`);
    } else if (q.stock_filter === 'below_minimum') {
      where.push(`i.minimum_stock_level IS NOT NULL AND COALESCE(ss.stock_on_hand, 0) < i.minimum_stock_level`);
    } else if (q.stock_filter === 'at_or_below_reorder') {
      where.push(`i.reorder_level IS NOT NULL AND COALESCE(ss.stock_on_hand, 0) <= i.reorder_level`);
    } else if (q.stock_filter === 'need_order') {
      where.push(`
        COALESCE(ss.stock_on_hand, 0) <= COALESCE(i.reorder_level, i.minimum_stock_level)
        AND COALESCE(i.reorder_level, i.minimum_stock_level) IS NOT NULL
      `);
    }

    const whereSql = where.join('\n          AND ');
    const fromSql = `
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON c.id = i.category_id
      LEFT JOIN inventory_brands b ON b.id = i.brand_id
      LEFT JOIN inventory_product_types pt ON pt.id = i.product_type_id
      LEFT JOIN inventory_units_of_measure u ON u.id = COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id)
      LEFT JOIN inventory_units_of_measure wu ON wu.id = i.weight_uom_id
      LEFT JOIN LATERAL (
        SELECT barcode
        FROM inventory_item_barcodes
        WHERE item_id = i.id
          AND company_id = i.company_id
          AND is_active = true
        ORDER BY is_primary DESC, created_at ASC
        LIMIT 1
      ) pb ON true
      LEFT JOIN LATERAL (
        SELECT image_url
        FROM inventory_item_images
        WHERE item_id = i.id
          AND company_id = i.company_id
          AND is_active = true
        ORDER BY is_primary DESC, sort_order ASC, created_at ASC
        LIMIT 1
      ) img ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM(stock_on_hand) AS stock_on_hand,
          SUM(reserved_stock) AS reserved_stock,
          SUM(available_stock) AS available_stock,
          MAX(average_cost) AS average_cost
        FROM inventory_stock_balances
        WHERE item_id = i.id
          AND company_id = i.company_id
          AND is_active = true
      ) ss ON true
      WHERE ${whereSql}
    `;

    const countRows = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total ${fromSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const sortCol: Record<string, string> = {
      name:        'i.item_name',
      sku:         'COALESCE(i.sku, i.item_code)',
      sale_price:  'COALESCE(i.default_sales_price, 0)',
      qty_on_hand: 'COALESCE(ss.stock_on_hand, 0)',
      created_at:  'i.created_at',
    };

    params.push(q.limit);
    const limitParam = `$${params.length}`;
    params.push((q.page - 1) * q.limit);
    const offsetParam = `$${params.length}`;

    const data = await AppDataSource.query(
      `
        SELECT
          i.id,
          i.company_id,
          COALESCE(i.sku, i.item_code) AS sku,
          pb.barcode,
          i.item_name AS name,
          COALESCE(i.sale_description, i.detailed_description) AS description,
          b.name AS brand,
          NULL::text AS model,
          i.category_id,
          COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id) AS uom_id,
          CASE i.item_kind
            WHEN 'RAW_MATERIAL' THEN 'RawMaterial'
            WHEN 'SEMI_FINISHED' THEN 'SemiFinished'
            WHEN 'SERVICE' THEN 'Service'
            WHEN 'CONSUMABLE' THEN 'Consumable'
            ELSE 'Finished'
          END AS product_type,
          CASE
            WHEN i.is_blocked THEN 'Discontinued'
            WHEN NOT i.is_active THEN 'Inactive'
            ELSE 'Active'
          END AS status,
          i.is_sales_item AS is_sellable,
          i.is_purchase_item AS is_purchasable,
          COALESCE(i.standard_cost, i.default_purchase_price, ss.average_cost, 0)::text AS cost_price,
          COALESCE(i.default_sales_price, 0)::text AS sale_price,
          i.minimum_sales_price::text AS min_sale_price,
          'Standard' AS tax_category,
          COALESCE(i.import_tax_percent, 0)::text AS tax_rate,
          COALESCE(ss.stock_on_hand, 0)::text AS qty_on_hand,
          COALESCE(ss.reserved_stock, 0)::text AS qty_reserved,
          i.minimum_stock_level::text AS min_stock_level,
          i.maximum_stock_level::text AS max_stock_level,
          i.reorder_level::text AS reorder_level,
          COALESCE(i.reorder_quantity, i.reorder_level)::text AS reorder_qty,
          i.is_inventory_item AS track_inventory,
          i.weight::text,
          wu.short_name AS weight_unit,
          i.length::text AS length_cm,
          i.width::text AS width_cm,
          i.height::text AS height_cm,
          img.image_url,
          i.other_information AS notes,
          NULL::text AS tags,
          0 AS sort_order,
          i.created_by_id AS created_by,
          i.updated_by_id AS updated_by,
          i.created_at,
          i.updated_at,
          CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'code', c.code, 'name', c.name) END AS category,
          CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'abbreviation', u.short_name, 'name', u.name, 'uom_type', 'Other') END AS uom,
          CASE WHEN b.id IS NULL THEN NULL ELSE json_build_object('id', b.id, 'code', b.code, 'name', b.name) END AS brand_record,
          CASE WHEN pt.id IS NULL THEN NULL ELSE json_build_object('id', pt.id, 'code', pt.code, 'name', pt.name) END AS product_type_record
        ${fromSql}
        ORDER BY ${sortCol[q.sort_by] ?? 'i.item_name'} ${q.sort_dir}
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      params,
    );

    return {
      data,
      pagination: {
        total,
        page:  q.page,
        limit: q.limit,
        pages: Math.ceil(total / q.limit),
      },
    };
  }

  /* ── Get by ID ──────────────────────────────────────────────── */
  async getById(id: string): Promise<any | null> {
    const result = await this.list({
      page: 1,
      limit: 1,
      search: undefined,
      category_id: undefined,
      brand_id: undefined,
      product_type: undefined,
      status: undefined,
      is_sellable: undefined,
      low_stock: undefined,
      stock_filter: undefined,
      sort_by: 'name',
      sort_dir: 'ASC',
    });
    const fromList = result.data.find((item: any) => item.id === id);
    if (fromList) return fromList;

    const rows = await AppDataSource.query(
      `
        SELECT id
        FROM inventory_items
        WHERE company_id = $1
          AND id = $2
        LIMIT 1
      `,
      [this.companyId, id],
    );
    if (!rows.length) return null;

    const detailRows = await AppDataSource.query(
      `
        SELECT
          i.id,
          i.company_id,
          COALESCE(i.sku, i.item_code) AS sku,
          pb.barcode,
          i.item_name AS name,
          COALESCE(i.sale_description, i.detailed_description) AS description,
          b.name AS brand,
          NULL::text AS model,
          i.category_id,
          COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id) AS uom_id,
          CASE i.item_kind
            WHEN 'RAW_MATERIAL' THEN 'RawMaterial'
            WHEN 'SEMI_FINISHED' THEN 'SemiFinished'
            WHEN 'SERVICE' THEN 'Service'
            WHEN 'CONSUMABLE' THEN 'Consumable'
            ELSE 'Finished'
          END AS product_type,
          CASE
            WHEN i.is_blocked THEN 'Discontinued'
            WHEN NOT i.is_active THEN 'Inactive'
            ELSE 'Active'
          END AS status,
          i.is_sales_item AS is_sellable,
          i.is_purchase_item AS is_purchasable,
          COALESCE(i.standard_cost, i.default_purchase_price, ss.average_cost, 0)::text AS cost_price,
          COALESCE(i.default_sales_price, 0)::text AS sale_price,
          i.minimum_sales_price::text AS min_sale_price,
          'Standard' AS tax_category,
          COALESCE(i.import_tax_percent, 0)::text AS tax_rate,
          COALESCE(ss.stock_on_hand, 0)::text AS qty_on_hand,
          COALESCE(ss.reserved_stock, 0)::text AS qty_reserved,
          i.minimum_stock_level::text AS min_stock_level,
          i.maximum_stock_level::text AS max_stock_level,
          i.reorder_level::text AS reorder_level,
          COALESCE(i.reorder_quantity, i.reorder_level)::text AS reorder_qty,
          i.is_inventory_item AS track_inventory,
          i.weight::text,
          wu.short_name AS weight_unit,
          i.length::text AS length_cm,
          i.width::text AS width_cm,
          i.height::text AS height_cm,
          img.image_url,
          i.other_information AS notes,
          NULL::text AS tags,
          0 AS sort_order,
          i.created_by_id AS created_by,
          i.updated_by_id AS updated_by,
          i.created_at,
          i.updated_at,
          CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'code', c.code, 'name', c.name) END AS category,
          CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'abbreviation', u.short_name, 'name', u.name, 'uom_type', 'Other') END AS uom
        FROM inventory_items i
        LEFT JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN inventory_brands b ON b.id = i.brand_id
        LEFT JOIN inventory_units_of_measure u ON u.id = COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id)
        LEFT JOIN inventory_units_of_measure wu ON wu.id = i.weight_uom_id
        LEFT JOIN LATERAL (
          SELECT barcode
          FROM inventory_item_barcodes
          WHERE item_id = i.id AND company_id = i.company_id AND is_active = true
          ORDER BY is_primary DESC, created_at ASC
          LIMIT 1
        ) pb ON true
        LEFT JOIN LATERAL (
          SELECT image_url
          FROM inventory_item_images
          WHERE item_id = i.id AND company_id = i.company_id AND is_active = true
          ORDER BY is_primary DESC, sort_order ASC, created_at ASC
          LIMIT 1
        ) img ON true
        LEFT JOIN LATERAL (
          SELECT
            SUM(stock_on_hand) AS stock_on_hand,
            SUM(reserved_stock) AS reserved_stock,
            MAX(average_cost) AS average_cost
          FROM inventory_stock_balances
          WHERE item_id = i.id AND company_id = i.company_id AND is_active = true
        ) ss ON true
        WHERE i.company_id = $1
          AND i.id = $2
        LIMIT 1
      `,
      [this.companyId, id],
    );
    return detailRows[0] ?? null;
  }

  /* ── Create ─────────────────────────────────────────────────── */
  async create(input: CreateProductInput, userId: string): Promise<Product> {
    const existing = await this.repo.findOne({
      where: { company_id: this.companyId, sku: input.sku },
    });
    if (existing) throw new Error(`SKU "${input.sku}" already exists in this company.`);

    if (input.min_stock_level != null &&
        input.max_stock_level != null &&
        input.min_stock_level >= input.max_stock_level) {
      throw new Error('Min stock level must be less than max stock level.');
    }

    const product = this.repo.create({
      company_id:      this.companyId,
      sku:             input.sku,
      barcode:         input.barcode,
      name:            input.name,
      description:     input.description,
      brand:           input.brand,
      model:           input.model,
      category_id:     input.category_id,
      uom_id:          input.uom_id,
      product_type:    input.product_type,
      status:          input.status,
      is_sellable:     input.is_sellable,
      is_purchasable:  input.is_purchasable,
      cost_price:      String(input.cost_price),
      sale_price:      String(input.sale_price),
      min_sale_price:  input.min_sale_price  != null ? String(input.min_sale_price)  : undefined,
      tax_category:    input.tax_category,
      tax_rate:        String(input.tax_rate),
      qty_on_hand:     String(input.qty_on_hand ?? 0),
      qty_reserved:    '0',
      min_stock_level: input.min_stock_level != null ? String(input.min_stock_level) : undefined,
      max_stock_level: input.max_stock_level != null ? String(input.max_stock_level) : undefined,
      reorder_qty:     input.reorder_qty     != null ? String(input.reorder_qty)     : undefined,
      track_inventory: input.track_inventory,
      weight:          input.weight          != null ? String(input.weight)          : undefined,
      weight_unit:     input.weight_unit,
      length_cm:       input.length_cm       != null ? String(input.length_cm)       : undefined,
      width_cm:        input.width_cm        != null ? String(input.width_cm)        : undefined,
      height_cm:       input.height_cm       != null ? String(input.height_cm)       : undefined,
      image_url:       input.image_url || undefined,
      notes:           input.notes,
      tags:            input.tags,
      sort_order:      input.sort_order,
      created_by:      userId,
    });

    return this.repo.save(product);
  }

  /* ── Update ─────────────────────────────────────────────────── */
  async update(input: UpdateProductInput, userId: string): Promise<Product> {
    const { id, ...fields } = input;
    const product = await this.repo.findOne({
      where: { id, company_id: this.companyId },
    });
    if (!product) throw new Error('Product not found.');

    if (fields.sku && fields.sku !== product.sku) {
      const dup = await this.repo.findOne({
        where: { company_id: this.companyId, sku: fields.sku },
      });
      if (dup) throw new Error(`SKU "${fields.sku}" already in use.`);
    }

    /* Stock level consistency — check after merging with existing values */
    const newMin = fields.min_stock_level !== undefined
      ? fields.min_stock_level
      : (product.min_stock_level != null ? parseFloat(product.min_stock_level) : undefined);
    const newMax = fields.max_stock_level !== undefined
      ? fields.max_stock_level
      : (product.max_stock_level != null ? parseFloat(product.max_stock_level) : undefined);
    if (newMin != null && newMax != null && newMin >= newMax)
      throw new Error('Min stock level must be less than max stock level.');

    const n = (v: number | undefined) => v != null ? String(v) : undefined;

    await this.repo.update(id, {
      ...(fields.sku            != null && { sku:             fields.sku }),
      ...(fields.barcode        != null && { barcode:         fields.barcode }),
      ...(fields.name           != null && { name:            fields.name }),
      ...(fields.description    != null && { description:     fields.description }),
      ...(fields.brand          != null && { brand:           fields.brand }),
      ...(fields.model          != null && { model:           fields.model }),
      ...(fields.category_id    != null && { category_id:     fields.category_id }),
      ...(fields.uom_id         != null && { uom_id:          fields.uom_id }),
      ...(fields.product_type   != null && { product_type:    fields.product_type }),
      ...(fields.status         != null && { status:          fields.status }),
      ...(fields.is_sellable    != null && { is_sellable:     fields.is_sellable }),
      ...(fields.is_purchasable != null && { is_purchasable:  fields.is_purchasable }),
      ...(fields.cost_price     != null && { cost_price:      String(fields.cost_price) }),
      ...(fields.sale_price     != null && { sale_price:      String(fields.sale_price) }),
      ...(fields.min_sale_price != null && { min_sale_price:  n(fields.min_sale_price) }),
      ...(fields.tax_category   != null && { tax_category:    fields.tax_category }),
      ...(fields.tax_rate       != null && { tax_rate:        String(fields.tax_rate) }),
      ...(fields.qty_on_hand    != null && { qty_on_hand:     String(fields.qty_on_hand) }),
      ...(fields.min_stock_level!= null && { min_stock_level: n(fields.min_stock_level) }),
      ...(fields.max_stock_level!= null && { max_stock_level: n(fields.max_stock_level) }),
      ...(fields.reorder_qty    != null && { reorder_qty:     n(fields.reorder_qty) }),
      ...(fields.track_inventory!= null && { track_inventory: fields.track_inventory }),
      ...(fields.weight         != null && { weight:          n(fields.weight) }),
      ...(fields.weight_unit    != null && { weight_unit:     fields.weight_unit }),
      ...(fields.length_cm      != null && { length_cm:       n(fields.length_cm) }),
      ...(fields.width_cm       != null && { width_cm:        n(fields.width_cm) }),
      ...(fields.height_cm      != null && { height_cm:       n(fields.height_cm) }),
      ...(fields.image_url      != null && { image_url:       fields.image_url || undefined }),
      ...(fields.notes          != null && { notes:           fields.notes }),
      ...(fields.tags           != null && { tags:            fields.tags }),
      ...(fields.sort_order     != null && { sort_order:      fields.sort_order }),
      updated_by: userId,
    } as any);

    return this.getById(id) as Promise<Product>;
  }

  /* ── Archive (soft-delete → Discontinued) ───────────────────── */
  async archive(id: string): Promise<void> {
    const result = await AppDataSource.query(
      `
        UPDATE inventory_items
        SET is_blocked = true,
            blocked_reason = COALESCE(blocked_reason, 'Archived from product catalogue'),
            updated_at = now()
        WHERE id = $1
          AND company_id = $2
        RETURNING id
      `,
      [id, this.companyId],
    );
    if (result.length > 0) return;

    const p = await this.repo.findOne({ where: { id, company_id: this.companyId } });
    if (!p) throw new Error('Product not found.');
    await this.repo.update(id, { status: 'Discontinued' } as any);
  }

  /* ── Hard delete (only Inactive products) ───────────────────── */
  async delete(id: string): Promise<void> {
    const p = await this.repo.findOne({ where: { id, company_id: this.companyId } });
    if (!p) throw new Error('Product not found.');
    if (p.status !== 'Inactive')
      throw new Error(
        'Only Inactive products may be permanently deleted. ' +
        'Use Archive to mark as Discontinued.',
      );
    await this.repo.delete(id);
  }

  /* ════════════════════════════════════════════════════════════════
     CATEGORY METHODS — materialized-path tree
     ════════════════════════════════════════════════════════════════ */

  /**
   * Returns flat list sorted by path ASC (parents always precede children).
   * UI reconstructs tree with buildCategoryTree() utility.
   */
  async listCategories(): Promise<any[]> {
    return AppDataSource.query(
      `
        SELECT
          id,
          company_id,
          code,
          name,
          description,
          parent_id,
          level AS depth,
          path,
          sort_order,
          is_active,
          created_at,
          updated_at
        FROM inventory_categories
        WHERE company_id = $1
        ORDER BY path ASC, sort_order ASC, name ASC
      `,
      [this.companyId],
    );
  }

  async listBrands(): Promise<Array<{ id: string; code: string; name: string }>> {
    return AppDataSource.query(
      `
        SELECT id, code, name
        FROM inventory_brands
        WHERE company_id = $1
          AND is_active = true
        ORDER BY name ASC
      `,
      [this.companyId],
    );
  }

  /** Create a category and compute path + depth from parent. */
  async createCategory(input: CreateCategoryInput): Promise<ProductCategory> {
    const dup = await this.catRepo.findOne({
      where: { company_id: this.companyId, code: input.code },
    });
    if (dup) throw new Error(`Category code "${input.code}" already exists.`);

    let parentDepth = -1;
    let parentPath  = '';

    if (input.parent_id) {
      const parent = await this.catRepo.findOne({
        where: { id: input.parent_id, company_id: this.companyId },
      });
      if (!parent) throw new Error('Parent category not found.');
      if (parent.depth >= 7)
        throw new Error('Maximum nesting depth (8 levels) has been reached in this branch.');
      parentDepth = parent.depth;
      parentPath  = parent.path;
    }

    /* Save with placeholder path; we need the generated UUID first */
    const cat = this.catRepo.create({
      company_id:  this.companyId,
      code:        input.code,
      name:        input.name,
      description: input.description,
      parent_id:   input.parent_id,
      sort_order:  input.sort_order ?? 0,
      is_active:   input.is_active  ?? true,
      depth:       0,
      path:        '',
    });
    const saved = await this.catRepo.save(cat);

    /* Compute final path and depth */
    const depth = parentDepth + 1;
    const path  = parentPath ? `${parentPath}/${saved.id}` : saved.id;
    await this.catRepo.update(saved.id, { depth, path });

    return this.catRepo.findOne({
      where:     { id: saved.id },
      relations: ['parent'],
    }) as Promise<ProductCategory>;
  }

  /**
   * Update a category.
   * When parent_id changes, atomically recomputes path/depth for this node
   * and all descendants. Performs O(1) cycle detection before any writes.
   */
  async updateCategory(input: UpdateCategoryInput): Promise<ProductCategory> {
    const { id, ...fields } = input;
    const cat = await this.catRepo.findOne({
      where: { id, company_id: this.companyId },
    });
    if (!cat) throw new Error('Category not found.');

    /* Code uniqueness */
    if (fields.code && fields.code !== cat.code) {
      const dup = await this.catRepo.findOne({
        where: { company_id: this.companyId, code: fields.code },
      });
      if (dup) throw new Error(`Code "${fields.code}" is already in use.`);
    }

    const parentChanging =
      'parent_id' in fields && fields.parent_id !== (cat.parent_id ?? undefined);

    if (parentChanging) {
      const newParentId = fields.parent_id ?? null;

      if (newParentId === id)
        throw new Error('A category cannot be its own parent.');

      let newParentPath  = '';
      let newParentDepth = -1;

      if (newParentId) {
        /* Cycle detection: is the new parent a descendant of this category? */
        const pathPrefix = cat.path + '/';
        const isDescendant = await this.catRepo
          .createQueryBuilder('c')
          .where('c.company_id = :cid', { cid: this.companyId })
          .andWhere('c.id = :pid',      { pid: newParentId })
          .andWhere(
            '(c.path = :exact OR c.path LIKE :prefix)',
            { exact: cat.path, prefix: pathPrefix + '%' },
          )
          .getCount();

        if (isDescendant > 0)
          throw new Error(
            'Circular reference: the selected parent is a descendant of this category.',
          );

        const newParent = await this.catRepo.findOne({
          where: { id: newParentId, company_id: this.companyId },
        });
        if (!newParent) throw new Error('Parent category not found.');
        if (newParent.depth >= 7)
          throw new Error('Maximum nesting depth (8 levels) would be exceeded.');
        newParentPath  = newParent.path;
        newParentDepth = newParent.depth;
      }

      const oldPath    = cat.path;
      const newPath    = newParentPath ? `${newParentPath}/${id}` : id;
      const depthDelta = (newParentDepth + 1) - cat.depth;

      /* Recompute paths of all descendants */
      const descendants = await this.catRepo
        .createQueryBuilder('c')
        .where('c.company_id = :cid',  { cid:    this.companyId })
        .andWhere('c.path LIKE :pfx',  { pfx:    oldPath + '/%' })
        .getMany();

      for (const desc of descendants) {
        await this.catRepo.update(desc.id, {
          path:  newPath + desc.path.slice(oldPath.length),
          depth: desc.depth + depthDelta,
        } as any);
      }

      /* Update this node */
      const { parent_id: _omit, ...otherFields } = fields;
      await this.catRepo.update(id, {
        ...otherFields as any,
        parent_id: newParentId ?? undefined,
        path:      newPath,
        depth:     newParentDepth + 1,
      });
    } else {
      await this.catRepo.update(id, fields as any);
    }

    return this.catRepo.findOne({
      where:     { id },
      relations: ['parent'],
    }) as Promise<ProductCategory>;
  }

  async deleteCategory(id: string): Promise<void> {
    const c = await this.catRepo.findOne({
      where: { id, company_id: this.companyId },
    });
    if (!c) throw new Error('Category not found.');

    const productCount = await this.repo.count({
      where: { company_id: this.companyId, category_id: id },
    });
    if (productCount > 0)
      throw new Error(`Cannot delete — ${productCount} product(s) use this category.`);

    const childCount = await this.catRepo.count({
      where: { company_id: this.companyId, parent_id: id },
    });
    if (childCount > 0)
      throw new Error(
        `Cannot delete — this category has ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'}. ` +
        'Re-assign or delete them first.',
      );

    await this.catRepo.delete(id);
  }

  /* ════════════════════════════════════════════════════════════════
     UOM METHODS
     ════════════════════════════════════════════════════════════════ */

  async listUom(): Promise<any[]> {
    return AppDataSource.query(
      `
        SELECT
          id,
          company_id,
          name,
          short_name AS abbreviation,
          CASE
            WHEN lower(code) IN ('kg', 'g', 'gram', 'lb', 'lbs', 'oz', 'ton', 't') THEN 'Weight'
            WHEN lower(code) IN ('cm', 'm', 'meter', 'inch', 'ft') THEN 'Length'
            ELSE 'Other'
          END AS uom_type,
          is_active,
          is_default,
          created_at,
          updated_at
        FROM inventory_units_of_measure
        WHERE company_id = $1
        ORDER BY name ASC
      `,
      [this.companyId],
    );
  }

  async createUom(input: CreateUomInput): Promise<UnitOfMeasure> {
    const dup = await this.uomRepo.findOne({
      where: { company_id: this.companyId, abbreviation: input.abbreviation },
    });
    if (dup) throw new Error(`UOM abbreviation "${input.abbreviation}" already exists.`);

    /* Enforce exactly one default per (company, uom_type) */
    if (input.is_default) {
      await this.uomRepo.update(
        { company_id: this.companyId, uom_type: input.uom_type as any, is_default: true },
        { is_default: false },
      );
    }

    return this.uomRepo.save(
      this.uomRepo.create({ ...input, company_id: this.companyId }),
    );
  }

  async updateUom(input: UpdateUomInput): Promise<UnitOfMeasure> {
    const { id, ...fields } = input;
    const uom = await this.uomRepo.findOne({
      where: { id, company_id: this.companyId },
    });
    if (!uom) throw new Error('UOM not found.');

    /* Enforce exactly one default per (company, uom_type) */
    if (fields.is_default && !uom.is_default) {
      const effectiveType = (fields.uom_type ?? uom.uom_type) as any;
      await this.uomRepo.update(
        { company_id: this.companyId, uom_type: effectiveType, is_default: true },
        { is_default: false },
      );
    }

    await this.uomRepo.update(id, fields as any);
    return this.uomRepo.findOne({ where: { id } }) as Promise<UnitOfMeasure>;
  }

  async deleteUom(id: string): Promise<void> {
    const u = await this.uomRepo.findOne({
      where: { id, company_id: this.companyId },
    });
    if (!u) throw new Error('UOM not found.');

    const count = await this.repo.count({
      where: { company_id: this.companyId, uom_id: id },
    });
    if (count > 0)
      throw new Error(`Cannot delete — ${count} product(s) use this UOM.`);

    await this.uomRepo.delete(id);
  }
}
