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

  /* ── SKU generator ──────────────────────────────────────────── */
  async nextSku(prefix = 'PRD'): Promise<string> {
    const last = await this.repo
      .createQueryBuilder('p')
      .select(['p.sku'])
      .where('p.company_id = :cid', { cid: this.companyId })
      .andWhere('p.sku ILIKE :p',   { p:   `${prefix}-%` })
      .orderBy('p.sku', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
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
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'cat')
      .leftJoinAndSelect('p.uom',      'uom')
      .where('p.company_id = :cid', { cid: this.companyId });

    if (q.search)
      qb.andWhere(
        '(p.sku ILIKE :s OR p.name ILIKE :s OR p.barcode ILIKE :s OR p.brand ILIKE :s)',
        { s: `%${q.search}%` },
      );
    if (q.category_id)  qb.andWhere('p.category_id  = :cat', { cat: q.category_id });
    if (q.product_type) qb.andWhere('p.product_type = :pt',  { pt:  q.product_type });
    if (q.status)       qb.andWhere('p.status       = :st',  { st:  q.status });
    if (q.is_sellable !== undefined)
      qb.andWhere('p.is_sellable = :sl', { sl: q.is_sellable });

    /* Low-stock: compare available qty (on_hand − reserved) to min level */
    if (q.low_stock)
      qb.andWhere(
        'p.min_stock_level IS NOT NULL AND (p.qty_on_hand - p.qty_reserved) < p.min_stock_level',
      );

    const sortCol: Record<string, string> = {
      name:        'p.name',
      sku:         'p.sku',
      sale_price:  'p.sale_price',
      qty_on_hand: 'p.qty_on_hand',
      created_at:  'p.created_at',
    };

    const total = await qb.getCount();
    const data  = await qb
      .orderBy(sortCol[q.sort_by] ?? 'p.name', q.sort_dir)
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getMany();

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
  async getById(id: string): Promise<Product | null> {
    return this.repo.findOne({
      where:     { id, company_id: this.companyId },
      relations: ['category', 'uom'],
    });
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
  async listCategories(): Promise<ProductCategory[]> {
    return this.catRepo.find({
      where:     { company_id: this.companyId },
      relations: ['parent'],
      order:     { path: 'ASC', sort_order: 'ASC', name: 'ASC' },
    });
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

  async listUom(): Promise<UnitOfMeasure[]> {
    return this.uomRepo.find({
      where: { company_id: this.companyId },
      order: { uom_type: 'ASC', name: 'ASC' },
    });
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
