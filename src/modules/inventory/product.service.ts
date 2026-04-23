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
   ================================================================ */
export class ProductService {
  private repo     = AppDataSource.getRepository(Product);
  private catRepo  = AppDataSource.getRepository(ProductCategory);
  private uomRepo  = AppDataSource.getRepository(UnitOfMeasure);

  constructor(private companyId: string) {}

  /* ── SKU generator ──────────────────────────────────────────── */
  async nextSku(prefix = 'PRD'): Promise<string> {
    const last = await this.repo
      .createQueryBuilder('p')
      .where('p.company_id = :cid', { cid: this.companyId })
      .andWhere('p.sku LIKE :p', { p: `${prefix}-%` })
      .orderBy('p.sku', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const parts = last.sku.split('-');
      const n = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  /* ── List ───────────────────────────────────────────────────── */
  async list(q: ListProductsQuery) {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'cat')
      .leftJoinAndSelect('p.uom', 'uom')
      .where('p.company_id = :cid', { cid: this.companyId });

    if (q.search) {
      qb.andWhere(
        '(p.sku ILIKE :s OR p.name ILIKE :s OR p.barcode ILIKE :s OR p.brand ILIKE :s)',
        { s: `%${q.search}%` },
      );
    }
    if (q.category_id)  qb.andWhere('p.category_id = :cat',  { cat: q.category_id });
    if (q.product_type) qb.andWhere('p.product_type = :pt',  { pt:  q.product_type });
    if (q.status)       qb.andWhere('p.status = :st',        { st:  q.status });
    if (q.is_sellable !== undefined) qb.andWhere('p.is_sellable = :sl', { sl: q.is_sellable });
    if (q.low_stock)    qb.andWhere('p.min_stock_level IS NOT NULL AND p.qty_on_hand < p.min_stock_level');

    const sortCol = {
      name:       'p.name',
      sku:        'p.sku',
      sale_price: 'p.sale_price',
      qty_on_hand:'p.qty_on_hand',
      created_at: 'p.created_at',
    }[q.sort_by] ?? 'p.name';

    const total = await qb.getCount();
    const data  = await qb
      .orderBy(sortCol, q.sort_dir)
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getMany();

    return {
      data,
      pagination: { total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) },
    };
  }

  /* ── Get by ID ──────────────────────────────────────────────── */
  async getById(id: string): Promise<Product | null> {
    return this.repo.findOne({
      where: { id, company_id: this.companyId },
      relations: ['category', 'uom'],
    });
  }

  /* ── Create ─────────────────────────────────────────────────── */
  async create(input: CreateProductInput, userId: string): Promise<Product> {
    const existing = await this.repo.findOne({ where: { company_id: this.companyId, sku: input.sku } });
    if (existing) throw new Error(`SKU "${input.sku}" already exists in this company.`);

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
      min_sale_price:  input.min_sale_price !== undefined ? String(input.min_sale_price) : undefined,
      tax_category:    input.tax_category,
      tax_rate:        String(input.tax_rate),
      qty_on_hand:     String(input.qty_on_hand ?? 0),
      qty_reserved:    '0',
      min_stock_level: input.min_stock_level !== undefined ? String(input.min_stock_level) : undefined,
      max_stock_level: input.max_stock_level !== undefined ? String(input.max_stock_level) : undefined,
      reorder_qty:     input.reorder_qty     !== undefined ? String(input.reorder_qty)     : undefined,
      track_inventory: input.track_inventory,
      weight:          input.weight     !== undefined ? String(input.weight)     : undefined,
      weight_unit:     input.weight_unit,
      length_cm:       input.length_cm  !== undefined ? String(input.length_cm)  : undefined,
      width_cm:        input.width_cm   !== undefined ? String(input.width_cm)   : undefined,
      height_cm:       input.height_cm  !== undefined ? String(input.height_cm)  : undefined,
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
    const product = await this.repo.findOne({ where: { id, company_id: this.companyId } });
    if (!product) throw new Error('Product not found.');

    if (fields.sku && fields.sku !== product.sku) {
      const dup = await this.repo.findOne({ where: { company_id: this.companyId, sku: fields.sku } });
      if (dup) throw new Error(`SKU "${fields.sku}" already in use.`);
    }

    const numStr = (v: number | undefined) => v !== undefined ? String(v) : undefined;

    await this.repo.update(id, {
      ...(fields.sku           !== undefined && { sku:             fields.sku }),
      ...(fields.barcode        !== undefined && { barcode:         fields.barcode }),
      ...(fields.name           !== undefined && { name:            fields.name }),
      ...(fields.description    !== undefined && { description:     fields.description }),
      ...(fields.brand          !== undefined && { brand:           fields.brand }),
      ...(fields.model          !== undefined && { model:           fields.model }),
      ...(fields.category_id    !== undefined && { category_id:     fields.category_id }),
      ...(fields.uom_id         !== undefined && { uom_id:          fields.uom_id }),
      ...(fields.product_type   !== undefined && { product_type:    fields.product_type }),
      ...(fields.status         !== undefined && { status:          fields.status }),
      ...(fields.is_sellable    !== undefined && { is_sellable:     fields.is_sellable }),
      ...(fields.is_purchasable !== undefined && { is_purchasable:  fields.is_purchasable }),
      ...(fields.cost_price     !== undefined && { cost_price:      String(fields.cost_price) }),
      ...(fields.sale_price     !== undefined && { sale_price:      String(fields.sale_price) }),
      ...(fields.min_sale_price !== undefined && { min_sale_price:  numStr(fields.min_sale_price) }),
      ...(fields.tax_category   !== undefined && { tax_category:    fields.tax_category }),
      ...(fields.tax_rate       !== undefined && { tax_rate:        String(fields.tax_rate) }),
      ...(fields.qty_on_hand    !== undefined && { qty_on_hand:     String(fields.qty_on_hand) }),
      ...(fields.min_stock_level!== undefined && { min_stock_level: numStr(fields.min_stock_level) }),
      ...(fields.max_stock_level!== undefined && { max_stock_level: numStr(fields.max_stock_level) }),
      ...(fields.reorder_qty    !== undefined && { reorder_qty:     numStr(fields.reorder_qty) }),
      ...(fields.track_inventory!== undefined && { track_inventory: fields.track_inventory }),
      ...(fields.weight         !== undefined && { weight:          numStr(fields.weight) }),
      ...(fields.weight_unit    !== undefined && { weight_unit:     fields.weight_unit }),
      ...(fields.length_cm      !== undefined && { length_cm:       numStr(fields.length_cm) }),
      ...(fields.width_cm       !== undefined && { width_cm:        numStr(fields.width_cm) }),
      ...(fields.height_cm      !== undefined && { height_cm:       numStr(fields.height_cm) }),
      ...(fields.image_url      !== undefined && { image_url:       fields.image_url || undefined }),
      ...(fields.notes          !== undefined && { notes:           fields.notes }),
      ...(fields.tags           !== undefined && { tags:            fields.tags }),
      ...(fields.sort_order     !== undefined && { sort_order:      fields.sort_order }),
      updated_by: userId,
    } as any);

    return this.getById(id) as Promise<Product>;
  }

  /* ── Archive (soft-delete) ──────────────────────────────────── */
  async archive(id: string): Promise<void> {
    const p = await this.repo.findOne({ where: { id, company_id: this.companyId } });
    if (!p) throw new Error('Product not found.');
    await this.repo.update(id, { status: 'Discontinued' } as any);
  }

  /* ── Delete (hard — only Draft / never-sold products) ──────── */
  async delete(id: string): Promise<void> {
    const p = await this.repo.findOne({ where: { id, company_id: this.companyId } });
    if (!p) throw new Error('Product not found.');
    await this.repo.delete(id);
  }

  /* ── SKU suggestion ─────────────────────────────────────────── */
  async suggestSku(prefix?: string): Promise<string> {
    return this.nextSku(prefix ?? 'PRD');
  }

  /* ════════════════════════════════════════════════════════════
     CATEGORY METHODS
     ════════════════════════════════════════════════════════════ */
  async listCategories() {
    return this.catRepo.find({
      where: { company_id: this.companyId },
      relations: ['parent'],
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async createCategory(input: CreateCategoryInput): Promise<ProductCategory> {
    const dup = await this.catRepo.findOne({ where: { company_id: this.companyId, code: input.code } });
    if (dup) throw new Error(`Category code "${input.code}" already exists.`);
    return this.catRepo.save(this.catRepo.create({ ...input, company_id: this.companyId }));
  }

  async updateCategory(input: UpdateCategoryInput): Promise<ProductCategory> {
    const { id, ...fields } = input;
    const cat = await this.catRepo.findOne({ where: { id, company_id: this.companyId } });
    if (!cat) throw new Error('Category not found.');
    if (fields.code && fields.code !== cat.code) {
      const dup = await this.catRepo.findOne({ where: { company_id: this.companyId, code: fields.code } });
      if (dup) throw new Error(`Code "${fields.code}" already in use.`);
    }
    await this.catRepo.update(id, fields as any);
    return this.catRepo.findOne({ where: { id }, relations: ['parent'] }) as Promise<ProductCategory>;
  }

  async deleteCategory(id: string): Promise<void> {
    const c = await this.catRepo.findOne({ where: { id, company_id: this.companyId } });
    if (!c) throw new Error('Category not found.');
    const count = await this.repo.count({ where: { company_id: this.companyId, category_id: id } });
    if (count > 0) throw new Error(`Cannot delete — ${count} product(s) use this category.`);
    await this.catRepo.delete(id);
  }

  /* ════════════════════════════════════════════════════════════
     UOM METHODS
     ════════════════════════════════════════════════════════════ */
  async listUom() {
    return this.uomRepo.find({
      where: { company_id: this.companyId },
      order: { uom_type: 'ASC', name: 'ASC' },
    });
  }

  async createUom(input: CreateUomInput): Promise<UnitOfMeasure> {
    const dup = await this.uomRepo.findOne({ where: { company_id: this.companyId, abbreviation: input.abbreviation } });
    if (dup) throw new Error(`UOM abbreviation "${input.abbreviation}" already exists.`);
    return this.uomRepo.save(this.uomRepo.create({ ...input, company_id: this.companyId }));
  }

  async updateUom(input: UpdateUomInput): Promise<UnitOfMeasure> {
    const { id, ...fields } = input;
    const uom = await this.uomRepo.findOne({ where: { id, company_id: this.companyId } });
    if (!uom) throw new Error('UOM not found.');
    await this.uomRepo.update(id, fields as any);
    return this.uomRepo.findOne({ where: { id } }) as Promise<UnitOfMeasure>;
  }

  async deleteUom(id: string): Promise<void> {
    const u = await this.uomRepo.findOne({ where: { id, company_id: this.companyId } });
    if (!u) throw new Error('UOM not found.');
    const count = await this.repo.count({ where: { company_id: this.companyId, uom_id: id } });
    if (count > 0) throw new Error(`Cannot delete — ${count} product(s) use this UOM.`);
    await this.uomRepo.delete(id);
  }
}
