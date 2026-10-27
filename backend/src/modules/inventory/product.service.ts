import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { AccessScope } from '../auth/access-rules.js';
import type {
  CreateBrandInput,
  CreateCategoryInput,
  CreateColorInput,
  CreateOriginInput,
  CreateProductInput,
  CreateProductTypeInput,
  CreateSizeInput,
  CreateUomInput,
  ListProductsQuery,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateColorInput,
  UpdateOriginInput,
  UpdateProductInput,
  UpdateProductTypeInput,
  UpdateSizeInput,
  UpdateUomInput,
} from './product.schema.js';
import { logAuditEvent } from '../audit/audit.service.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function toItemKind(productType?: string) {
  const map: Record<string, string> = {
    Finished: 'FINISHED_GOOD',
    RawMaterial: 'RAW_MATERIAL',
    SemiFinished: 'SEMI_FINISHED',
    Service: 'SERVICE',
    Consumable: 'CONSUMABLE',
  };
  return productType ? map[productType] : undefined;
}

function toProductType(itemKind?: string) {
  const map: Record<string, string> = {
    RAW_MATERIAL: 'RawMaterial',
    SEMI_FINISHED: 'SemiFinished',
    SERVICE: 'Service',
    CONSUMABLE: 'Consumable',
    FINISHED_GOOD: 'Finished',
  };
  return itemKind ? map[itemKind] ?? 'Finished' : 'Finished';
}

function statusFields(status?: string) {
  if (status === 'Inactive') return { isActive: false, isBlocked: false };
  if (status === 'Discontinued') return { isActive: true, isBlocked: true };
  return { isActive: true, isBlocked: false };
}

function decimalText(value?: number | null) {
  return value == null ? undefined : String(value);
}

function uomTypeFromCode(code?: string | null) {
  const lower = (code ?? '').toLowerCase();
  if (['kg', 'g', 'gram', 'lb', 'lbs', 'oz', 'ton', 't'].includes(lower)) return 'Weight';
  if (['cm', 'm', 'meter', 'inch', 'ft'].includes(lower)) return 'Length';
  return 'Other';
}

export class ProductService {
  /** `scope` limits stock figures: Branch users see their Branch's stock, Warehouse users their Warehouse's. */
  constructor(private readonly companyId: string, private readonly scope?: AccessScope) {}

  /** Adds the user's Branch / Warehouse to `params` and returns the matching stock filter (empty for All Branches). */
  private visibleStockSql(params: unknown[]) {
    if (this.scope?.accessLevel === 'BRANCH') {
      params.push(this.scope.branchId);
      return `AND branch_id = CAST($${params.length} AS uuid)`;
    }
    if (this.scope?.accessLevel === 'WAREHOUSE') {
      params.push(this.scope.warehouseId);
      return `AND warehouse_id = CAST($${params.length} AS uuid)`;
    }
    return '';
  }

  async suggestSku(prefix = 'PRD') {
    const rows = await prisma.$queryRawUnsafe<Array<{ sku?: string }>>(
      `
        SELECT COALESCE(sku, item_code) AS sku
        FROM inventory_items
        WHERE company_id = CAST($1 AS uuid)
          AND COALESCE(sku, item_code) ILIKE $2
        ORDER BY COALESCE(sku, item_code) DESC
        LIMIT 1
      `,
      this.companyId,
      `${prefix}-%`,
    );

    const segment = rows[0]?.sku?.split('-').pop() ?? '';
    const next = Number.isFinite(Number.parseInt(segment, 10)) ? Number.parseInt(segment, 10) + 1 : 1;
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  async list(query: ListProductsQuery) {
    const params: unknown[] = [this.companyId];
    const where: string[] = ['i.company_id = CAST($1 AS uuid)'];

    if (query.search) {
      params.push(`%${query.search}%`);
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

    if (query.category_id) {
      params.push(query.category_id);
      where.push(`i.category_id = CAST($${params.length} AS uuid)`);
    }
    if (query.brand_id) {
      params.push(query.brand_id);
      where.push(`i.brand_id = CAST($${params.length} AS uuid)`);
    }
    if (query.product_type_id) {
      params.push(query.product_type_id);
      where.push(`i.product_type_id = CAST($${params.length} AS uuid)`);
    }
    if (query.item_size_id) {
      params.push(query.item_size_id);
      where.push(`i.item_size_id = CAST($${params.length} AS uuid)`);
    }
    if (query.color_id) {
      params.push(query.color_id);
      where.push(`i.color_id = CAST($${params.length} AS uuid)`);
    }
    if (query.origin_id) {
      params.push(query.origin_id);
      where.push(`i.origin_id = CAST($${params.length} AS uuid)`);
    }
    const itemKind = toItemKind(query.product_type);
    if (itemKind) {
      params.push(itemKind);
      where.push(`i.item_kind = CAST($${params.length} AS "InventoryItemKind")`);
    }
    if (query.status === 'Active') {
      where.push('i.is_active = true AND i.is_blocked = false');
    } else if (query.status === 'Inactive') {
      where.push('i.is_active = false');
    } else if (query.status === 'Discontinued') {
      where.push('i.is_blocked = true');
    }
    if (query.is_sellable !== undefined) {
      params.push(query.is_sellable);
      where.push(`i.is_sales_item = $${params.length}`);
    }
    if (query.low_stock) {
      where.push('i.minimum_stock_level IS NOT NULL AND COALESCE(ss.stock_on_hand, 0) < i.minimum_stock_level');
    }
    if (query.stock_filter === 'out_of_stock') {
      where.push('COALESCE(ss.stock_on_hand, 0) <= 0');
    } else if (query.stock_filter === 'below_minimum') {
      where.push('i.minimum_stock_level IS NOT NULL AND COALESCE(ss.stock_on_hand, 0) < i.minimum_stock_level');
    } else if (query.stock_filter === 'at_or_below_reorder') {
      where.push('i.reorder_level IS NOT NULL AND COALESCE(ss.stock_on_hand, 0) <= i.reorder_level');
    } else if (query.stock_filter === 'need_order') {
      where.push(`COALESCE(ss.stock_on_hand, 0) <= COALESCE(i.reorder_level, i.minimum_stock_level)
        AND COALESCE(i.reorder_level, i.minimum_stock_level) IS NOT NULL`);
    }

    const whereSql = where.join('\n          AND ');
    const stockSql = this.visibleStockSql(params);
    const fromSql = `
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON c.id = i.category_id
      LEFT JOIN inventory_brands b ON b.id = i.brand_id
      LEFT JOIN inventory_product_types pt ON pt.id = i.product_type_id
      LEFT JOIN inventory_item_sizes sz ON sz.id = i.item_size_id
      LEFT JOIN inventory_item_colors cl ON cl.id = i.color_id
      LEFT JOIN inventory_origins o ON o.id = i.origin_id
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
          SUM(available_stock) AS available_stock,
          MAX(average_cost) AS average_cost
        FROM inventory_stock_balances
        WHERE item_id = i.id AND company_id = i.company_id AND is_active = true ${stockSql}
      ) ss ON true
      WHERE ${whereSql}
    `;

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total ${fromSql}`,
      ...params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const sortColumns: Record<string, string> = {
      name: 'i.item_name',
      sku: 'COALESCE(i.sku, i.item_code)',
      sale_price: 'COALESCE(i.default_sales_price, 0)',
      qty_on_hand: 'COALESCE(ss.stock_on_hand, 0)',
      created_at: 'i.created_at',
    };
    params.push(query.limit, (query.page - 1) * query.limit);

    const data = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          i.id,
          i.company_id,
          COALESCE(i.sku, i.item_code) AS sku,
          pb.barcode,
          i.item_name AS name,
          COALESCE(i.sale_description, i.detailed_description) AS description,
          b.name AS brand,
          i.brand_id,
          i.product_type_id,
          i.item_size_id,
          i.color_id,
          i.origin_id,
          sz.name AS size_name,
          cl.name AS color_name,
          cl.hex_code AS color_hex,
          o.name AS origin_name,
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
          CASE WHEN i.is_blocked THEN 'Discontinued' WHEN NOT i.is_active THEN 'Inactive' ELSE 'Active' END AS status,
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
          COALESCE(i.notes, i.other_information) AS notes,
          NULL::text AS tags,
          0 AS sort_order,
          i.created_by_id AS created_by,
          i.updated_by_id AS updated_by,
          i.created_at,
          i.updated_at,
          CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'code', c.code, 'name', c.name) END AS category,
          CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'abbreviation', u.short_name, 'name', u.name, 'uom_type', 'Other') END AS uom,
          CASE WHEN b.id IS NULL THEN NULL ELSE json_build_object('id', b.id, 'code', b.code, 'name', b.name) END AS brand_record,
          CASE WHEN pt.id IS NULL THEN NULL ELSE json_build_object('id', pt.id, 'code', pt.code, 'name', pt.name) END AS product_type_record,
          CASE WHEN sz.id IS NULL THEN NULL ELSE json_build_object('id', sz.id, 'code', sz.code, 'name', sz.name) END AS size_record,
          CASE WHEN cl.id IS NULL THEN NULL ELSE json_build_object('id', cl.id, 'code', cl.code, 'name', cl.name, 'hex_code', cl.hex_code) END AS color_record,
          CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object('id', o.id, 'code', o.code, 'name', o.name) END AS origin_record
        ${fromSql}
        ORDER BY ${sortColumns[query.sort_by] ?? 'i.item_name'} ${query.sort_dir}
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      ...params,
    );

    return {
      data,
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    };
  }

  async getById(id: string) {
    const params: unknown[] = [this.companyId, id];
    const stockSql = this.visibleStockSql(params);
    const result = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT * FROM (
          SELECT
            i.id,
            i.company_id,
            COALESCE(i.sku, i.item_code) AS sku,
            pb.barcode,
            i.item_name AS name,
            COALESCE(i.sale_description, i.detailed_description) AS description,
            b.name AS brand,
            i.brand_id,
            i.product_type_id,
            i.item_size_id,
            i.color_id,
            i.origin_id,
            pt.name AS product_type_name,
            sz.name AS size_name,
            cl.name AS color_name,
            cl.hex_code AS color_hex,
            o.name AS origin_name,
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
            CASE WHEN i.is_blocked THEN 'Discontinued' WHEN NOT i.is_active THEN 'Inactive' ELSE 'Active' END AS status,
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
            COALESCE(i.notes, i.other_information) AS notes,
            NULL::text AS tags,
            0 AS sort_order,
            i.created_by_id AS created_by,
            i.updated_by_id AS updated_by,
            i.created_at,
            i.updated_at,
            CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'code', c.code, 'name', c.name) END AS category,
            CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'abbreviation', u.short_name, 'name', u.name, 'uom_type', 'Other') END AS uom,
            CASE WHEN b.id IS NULL THEN NULL ELSE json_build_object('id', b.id, 'code', b.code, 'name', b.name) END AS brand_record,
            CASE WHEN pt.id IS NULL THEN NULL ELSE json_build_object('id', pt.id, 'code', pt.code, 'name', pt.name) END AS product_type_record,
            CASE WHEN sz.id IS NULL THEN NULL ELSE json_build_object('id', sz.id, 'code', sz.code, 'name', sz.name) END AS size_record,
            CASE WHEN cl.id IS NULL THEN NULL ELSE json_build_object('id', cl.id, 'code', cl.code, 'name', cl.name, 'hex_code', cl.hex_code) END AS color_record,
            CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object('id', o.id, 'code', o.code, 'name', o.name) END AS origin_record
          FROM inventory_items i
          LEFT JOIN inventory_categories c ON c.id = i.category_id
          LEFT JOIN inventory_brands b ON b.id = i.brand_id
          LEFT JOIN inventory_product_types pt ON pt.id = i.product_type_id
          LEFT JOIN inventory_item_sizes sz ON sz.id = i.item_size_id
          LEFT JOIN inventory_item_colors cl ON cl.id = i.color_id
          LEFT JOIN inventory_origins o ON o.id = i.origin_id
          LEFT JOIN inventory_units_of_measure u ON u.id = COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id)
          LEFT JOIN inventory_units_of_measure wu ON wu.id = i.weight_uom_id
          LEFT JOIN LATERAL (
            SELECT barcode FROM inventory_item_barcodes
            WHERE item_id = i.id AND company_id = i.company_id AND is_active = true
            ORDER BY is_primary DESC, created_at ASC LIMIT 1
          ) pb ON true
          LEFT JOIN LATERAL (
            SELECT image_url FROM inventory_item_images
            WHERE item_id = i.id AND company_id = i.company_id AND is_active = true
            ORDER BY is_primary DESC, sort_order ASC, created_at ASC LIMIT 1
          ) img ON true
          LEFT JOIN LATERAL (
            SELECT SUM(stock_on_hand) AS stock_on_hand, SUM(reserved_stock) AS reserved_stock, MAX(average_cost) AS average_cost
            FROM inventory_stock_balances
            WHERE item_id = i.id AND company_id = i.company_id AND is_active = true ${stockSql}
          ) ss ON true
          WHERE i.company_id = CAST($1 AS uuid) AND i.id = CAST($2 AS uuid)
          LIMIT 1
        ) item
      `,
      ...params,
    );
    return result[0] ?? null;
  }

  async create(input: CreateProductInput) {
    await this.validateStockLevels(input.min_stock_level, input.max_stock_level);
    const duplicate = await prisma.inventoryItem.findFirst({
      where: { companyId: this.companyId, OR: [{ itemCode: input.sku }, { sku: input.sku }] },
    });
    if (duplicate) throw businessError(`SKU "${input.sku}" already exists in this company.`);

    const brandId = input.brand_id ?? (await this.findBrandId(input.brand));
    const weightUomId = await this.findUomIdByShortName(input.weight_unit);
    const status = statusFields(input.status);

    const item = await prisma.inventoryItem.create({
      data: {
        companyId: this.companyId,
        itemCode: input.sku,
        sku: input.sku,
        itemName: input.name,
        saleDescription: input.description,
        detailedDescription: input.description,
        categoryId: input.category_id,
        brandId,
        productTypeId: input.product_type_id,
        itemSizeId: input.item_size_id,
        colorId: input.color_id,
        originId: input.origin_id,
        baseUomId: input.uom_id,
        stockUomId: input.uom_id,
        purchaseUomId: input.uom_id,
        salesUomId: input.uom_id,
        itemKind: toItemKind(input.product_type) as any,
        isInventoryItem: input.track_inventory,
        isSalesItem: input.is_sellable,
        isPurchaseItem: input.is_purchasable,
        isServiceItem: input.product_type === 'Service',
        standardCost: decimalText(input.cost_price),
        defaultPurchasePrice: decimalText(input.cost_price),
        defaultSalesPrice: decimalText(input.sale_price),
        minimumSalesPrice: decimalText(input.min_sale_price),
        importTaxPercent: decimalText(input.tax_rate),
        minimumStockLevel: decimalText(input.min_stock_level),
        maximumStockLevel: decimalText(input.max_stock_level),
        reorderLevel: decimalText(input.reorder_qty),
        reorderQuantity: decimalText(input.reorder_qty),
        weight: decimalText(input.weight),
        weightUomId,
        length: decimalText(input.length_cm),
        width: decimalText(input.width_cm),
        height: decimalText(input.height_cm),
        notes: input.notes,
        otherInformation: input.notes,
        isActive: status.isActive,
        isBlocked: status.isBlocked,
      },
    });

    await this.replaceBarcodeAndImage(item.id, input.barcode, input.image_url);

    void logAuditEvent({
      companyId: this.companyId,
      actor: this.scope ? { id: this.scope.userId, email: '', fullName: 'User', role: this.scope.role, access: [] } : null,
      action: 'CREATE',
      entityName: 'Product',
      entityId: item.id,
      description: `Created product "${input.name}" (SKU: ${input.sku})`,
      details: { sku: input.sku, name: input.name, sale_price: input.sale_price },
    });

    return this.getById(item.id);
  }

  async update(input: UpdateProductInput) {
    const { id, ...fields } = input;
    const item = await prisma.inventoryItem.findFirst({ where: { id, companyId: this.companyId } });
    if (!item) throw businessError('Product not found.', 404);

    const minLevel = fields.min_stock_level ?? (item.minimumStockLevel == null ? undefined : Number(item.minimumStockLevel));
    const maxLevel = fields.max_stock_level ?? (item.maximumStockLevel == null ? undefined : Number(item.maximumStockLevel));
    await this.validateStockLevels(minLevel, maxLevel);

    if (fields.sku && fields.sku !== item.sku && fields.sku !== item.itemCode) {
      const duplicate = await prisma.inventoryItem.findFirst({
        where: { companyId: this.companyId, id: { not: id }, OR: [{ itemCode: fields.sku }, { sku: fields.sku }] },
      });
      if (duplicate) throw businessError(`SKU "${fields.sku}" is already used.`);
    }

    const brandId = fields.brand_id !== undefined ? fields.brand_id : (fields.brand !== undefined ? await this.findBrandId(fields.brand) : undefined);
    const weightUomId = fields.weight_unit !== undefined ? await this.findUomIdByShortName(fields.weight_unit) : undefined;
    const status = fields.status ? statusFields(fields.status) : {};

    await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(fields.sku !== undefined && { itemCode: fields.sku, sku: fields.sku }),
        ...(fields.name !== undefined && { itemName: fields.name }),
        ...(fields.description !== undefined && { saleDescription: fields.description, detailedDescription: fields.description }),
        ...(fields.category_id !== undefined && { categoryId: fields.category_id }),
        ...(brandId !== undefined && { brandId }),
        ...(fields.product_type_id !== undefined && { productTypeId: fields.product_type_id }),
        ...(fields.item_size_id !== undefined && { itemSizeId: fields.item_size_id }),
        ...(fields.color_id !== undefined && { colorId: fields.color_id }),
        ...(fields.origin_id !== undefined && { originId: fields.origin_id }),
        ...(fields.uom_id !== undefined && { baseUomId: fields.uom_id, stockUomId: fields.uom_id, purchaseUomId: fields.uom_id, salesUomId: fields.uom_id }),
        ...(fields.product_type !== undefined && { itemKind: toItemKind(fields.product_type) as any, isServiceItem: fields.product_type === 'Service' }),
        ...(fields.track_inventory !== undefined && { isInventoryItem: fields.track_inventory }),
        ...(fields.is_sellable !== undefined && { isSalesItem: fields.is_sellable }),
        ...(fields.is_purchasable !== undefined && { isPurchaseItem: fields.is_purchasable }),
        ...(fields.cost_price !== undefined && { standardCost: decimalText(fields.cost_price), defaultPurchasePrice: decimalText(fields.cost_price) }),
        ...(fields.sale_price !== undefined && { defaultSalesPrice: decimalText(fields.sale_price) }),
        ...(fields.min_sale_price !== undefined && { minimumSalesPrice: decimalText(fields.min_sale_price) }),
        ...(fields.tax_rate !== undefined && { importTaxPercent: decimalText(fields.tax_rate) }),
        ...(fields.min_stock_level !== undefined && { minimumStockLevel: decimalText(fields.min_stock_level) }),
        ...(fields.max_stock_level !== undefined && { maximumStockLevel: decimalText(fields.max_stock_level) }),
        ...(fields.reorder_qty !== undefined && { reorderLevel: decimalText(fields.reorder_qty), reorderQuantity: decimalText(fields.reorder_qty) }),
        ...(fields.weight !== undefined && { weight: decimalText(fields.weight) }),
        ...(fields.weight_unit !== undefined && { weightUomId }),
        ...(fields.length_cm !== undefined && { length: decimalText(fields.length_cm) }),
        ...(fields.width_cm !== undefined && { width: decimalText(fields.width_cm) }),
        ...(fields.height_cm !== undefined && { height: decimalText(fields.height_cm) }),
        ...(fields.notes !== undefined && { notes: fields.notes, otherInformation: fields.notes }),
        ...status,
      },
    });

    if (fields.barcode !== undefined || fields.image_url !== undefined) {
      await this.replaceBarcodeAndImage(id, fields.barcode, fields.image_url);
    }

    void logAuditEvent({
      companyId: this.companyId,
      actor: this.scope ? { id: this.scope.userId, email: '', fullName: 'User', role: this.scope.role, access: [] } : null,
      action: 'UPDATE',
      entityName: 'Product',
      entityId: id,
      description: `Updated product "${item.itemName}" (SKU: ${item.sku})`,
      details: { changes: fields },
    });

    return this.getById(id);
  }

  async archive(id: string) {
    const item = await prisma.inventoryItem.findFirst({ where: { id, companyId: this.companyId } });
    if (!item) throw businessError('Product not found.', 404);
    await prisma.inventoryItem.update({
      where: { id },
      data: { isBlocked: true, blockedReason: 'Archived by user' },
    });

    void logAuditEvent({
      companyId: this.companyId,
      actor: this.scope ? { id: this.scope.userId, email: '', fullName: 'User', role: this.scope.role, access: [] } : null,
      action: 'UPDATE',
      entityName: 'Product',
      entityId: id,
      description: `Archived product "${item.itemName}" (SKU: ${item.sku})`,
    });
  }

  async delete(id: string) {
    const item = await prisma.inventoryItem.findFirst({ where: { id, companyId: this.companyId } });
    if (!item) throw businessError('Product not found.', 404);
    if (item.isActive) throw businessError('Only Inactive products can be deleted for good. Use Archive to mark a product as Discontinued.');
    await prisma.inventoryItem.delete({ where: { id } });

    void logAuditEvent({
      companyId: this.companyId,
      actor: this.scope ? { id: this.scope.userId, email: '', fullName: 'User', role: this.scope.role, access: [] } : null,
      action: 'DELETE',
      entityName: 'Product',
      entityId: id,
      description: `Deleted product "${item.itemName}" (SKU: ${item.sku})`,
    });
  }

  /* ────────────────────────── CATEGORIES ────────────────────────── */

  async listCategories() {
    return prisma.$queryRawUnsafe<any[]>(
      `
        SELECT id, company_id, code, name, description, notes, parent_id, level AS depth, path, sort_order, is_active, created_at, updated_at
        FROM inventory_categories
        WHERE company_id = CAST($1 AS uuid)
        ORDER BY path ASC, sort_order ASC, name ASC
      `,
      this.companyId,
    );
  }

  async createCategory(input: CreateCategoryInput) {
    const duplicate = await prisma.inventoryCategory.findFirst({ where: { companyId: this.companyId, code: input.code } });
    if (duplicate) throw businessError(`Category Code "${input.code}" already exists.`);

    let parentLevel = -1;
    let parentPath = '';
    if (input.parent_id) {
      const parent = await prisma.inventoryCategory.findFirst({ where: { id: input.parent_id, companyId: this.companyId } });
      if (!parent) throw businessError('Parent Category not found.');
      if (parent.level >= 7) throw businessError('This Category already has the most levels allowed. You cannot add a level under it.');
      parentLevel = parent.level;
      parentPath = parent.path;
    }

    const category = await prisma.inventoryCategory.create({
      data: {
        companyId: this.companyId,
        code: input.code,
        name: input.name,
        description: input.description,
        notes: input.notes,
        parentId: input.parent_id,
        sortOrder: input.sort_order,
        isActive: input.is_active,
        level: parentLevel + 1,
        path: '',
      },
    });
    const path = parentPath ? `${parentPath}/${category.id}` : category.id;
    return prisma.inventoryCategory.update({ where: { id: category.id }, data: { path } });
  }

  async updateCategory(input: UpdateCategoryInput) {
    const { id, ...fields } = input;
    const category = await prisma.inventoryCategory.findFirst({ where: { id, companyId: this.companyId } });
    if (!category) throw businessError('Category not found.', 404);
    if (fields.code && fields.code !== category.code) {
      const duplicate = await prisma.inventoryCategory.findFirst({ where: { companyId: this.companyId, code: fields.code } });
      if (duplicate) throw businessError(`Category Code "${fields.code}" is already used.`);
    }
    if (fields.parent_id && fields.parent_id === id) throw businessError('A Category cannot be its own parent.');

    const newParentId = fields.parent_id === undefined ? category.parentId : (fields.parent_id || null);
    const moving = newParentId !== category.parentId;

    return prisma.$transaction(async transaction => {
      if (moving) await this.moveCategory(transaction, category, newParentId);
      return transaction.inventoryCategory.update({
        where: { id },
        data: {
          code: fields.code,
          name: fields.name,
          description: fields.description,
          notes: fields.notes,
          sortOrder: fields.sort_order,
          isActive: fields.is_active,
        },
      });
    });
  }

  private async moveCategory(
    transaction: Prisma.TransactionClient,
    category: { id: string; level: number; path: string },
    parentId: string | null,
  ) {
    let parentLevel = -1;
    let parentPath = '';
    if (parentId) {
      const parent = await transaction.inventoryCategory.findFirst({ where: { id: parentId, companyId: this.companyId } });
      if (!parent) throw businessError('Parent Category not found.');
      if (parent.path.split('/').includes(category.id)) {
        throw businessError('A Category cannot be moved under one of its own Sub Categories.');
      }
      parentLevel = parent.level;
      parentPath = parent.path;
    }

    const descendants = await transaction.inventoryCategory.findMany({
      where: { companyId: this.companyId, path: { startsWith: `${category.path}/` } },
      select: { id: true, level: true, path: true },
    });
    const newLevel = parentLevel + 1;
    const newPath = parentPath ? `${parentPath}/${category.id}` : category.id;
    const levelDiff = newLevel - category.level;

    await transaction.inventoryCategory.update({
      where: { id: category.id },
      data: { parentId, level: newLevel, path: newPath },
    });

    for (const d of descendants) {
      const subPath = d.path.slice(category.path.length);
      await transaction.inventoryCategory.update({
        where: { id: d.id },
        data: { level: d.level + levelDiff, path: `${newPath}${subPath}` },
      });
    }
  }

  async deleteCategory(id: string) {
    const [itemCount, childCount] = await Promise.all([
      prisma.inventoryItem.count({ where: { companyId: this.companyId, categoryId: id } }),
      prisma.inventoryCategory.count({ where: { companyId: this.companyId, parentId: id } }),
    ]);
    if (itemCount > 0) throw businessError(`This Category cannot be deleted. ${itemCount} product(s) use it.`);
    if (childCount > 0) throw businessError(`This Category cannot be deleted. It has ${childCount} Sub Categor${childCount === 1 ? 'y' : 'ies'}.`);
    const deleted = await prisma.inventoryCategory.deleteMany({ where: { id, companyId: this.companyId } });
    if (deleted.count === 0) throw businessError('Category not found.', 404);
  }

  /* ────────────────────────── BRANDS ────────────────────────── */

  async listBrands() {
    return prisma.brand.findMany({
      where: { companyId: this.companyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createBrand(input: CreateBrandInput) {
    const duplicate = await prisma.brand.findFirst({ where: { companyId: this.companyId, code: input.code } });
    if (duplicate) throw businessError(`Brand Code "${input.code}" already exists.`);
    return prisma.brand.create({
      data: {
        companyId: this.companyId,
        code: input.code,
        name: input.name,
        description: input.description,
        notes: input.notes,
        sortOrder: input.sort_order,
        isActive: input.is_active,
      },
    });
  }

  async updateBrand(input: UpdateBrandInput) {
    const { id, ...fields } = input;
    const existing = await prisma.brand.findFirst({ where: { id, companyId: this.companyId } });
    if (!existing) throw businessError('Brand not found.', 404);
    if (fields.code && fields.code !== existing.code) {
      const duplicate = await prisma.brand.findFirst({ where: { companyId: this.companyId, code: fields.code } });
      if (duplicate) throw businessError(`Brand Code "${fields.code}" is already used.`);
    }
    return prisma.brand.update({
      where: { id },
      data: {
        ...(fields.code !== undefined && { code: fields.code }),
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.description !== undefined && { description: fields.description }),
        ...(fields.notes !== undefined && { notes: fields.notes }),
        ...(fields.sort_order !== undefined && { sortOrder: fields.sort_order }),
        ...(fields.is_active !== undefined && { isActive: fields.is_active }),
      },
    });
  }

  async deleteBrand(id: string) {
    const count = await prisma.inventoryItem.count({ where: { companyId: this.companyId, brandId: id } });
    if (count > 0) throw businessError(`This Brand cannot be deleted. ${count} product(s) use it.`);
    const deleted = await prisma.brand.deleteMany({ where: { id, companyId: this.companyId } });
    if (deleted.count === 0) throw businessError('Brand not found.', 404);
  }

  /* ────────────────────────── PRODUCT TYPES ────────────────────────── */

  async listProductTypes() {
    return prisma.productType.findMany({
      where: { companyId: this.companyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createProductType(input: CreateProductTypeInput) {
    const duplicate = await prisma.productType.findFirst({ where: { companyId: this.companyId, code: input.code } });
    if (duplicate) throw businessError(`Product Type Code "${input.code}" already exists.`);
    return prisma.productType.create({
      data: {
        companyId: this.companyId,
        code: input.code,
        name: input.name,
        description: input.description,
        notes: input.notes,
        sortOrder: input.sort_order,
        isActive: input.is_active,
      },
    });
  }

  async updateProductType(input: UpdateProductTypeInput) {
    const { id, ...fields } = input;
    const existing = await prisma.productType.findFirst({ where: { id, companyId: this.companyId } });
    if (!existing) throw businessError('Product Type not found.', 404);
    if (fields.code && fields.code !== existing.code) {
      const duplicate = await prisma.productType.findFirst({ where: { companyId: this.companyId, code: fields.code } });
      if (duplicate) throw businessError(`Product Type Code "${fields.code}" is already used.`);
    }
    return prisma.productType.update({
      where: { id },
      data: {
        ...(fields.code !== undefined && { code: fields.code }),
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.description !== undefined && { description: fields.description }),
        ...(fields.notes !== undefined && { notes: fields.notes }),
        ...(fields.sort_order !== undefined && { sortOrder: fields.sort_order }),
        ...(fields.is_active !== undefined && { isActive: fields.is_active }),
      },
    });
  }

  async deleteProductType(id: string) {
    const count = await prisma.inventoryItem.count({ where: { companyId: this.companyId, productTypeId: id } });
    if (count > 0) throw businessError(`This Product Type cannot be deleted. ${count} product(s) use it.`);
    const deleted = await prisma.productType.deleteMany({ where: { id, companyId: this.companyId } });
    if (deleted.count === 0) throw businessError('Product Type not found.', 404);
  }

  /* ────────────────────────── ITEM SIZES ────────────────────────── */

  async listSizes() {
    return prisma.itemSize.findMany({
      where: { companyId: this.companyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createSize(input: CreateSizeInput) {
    const duplicate = await prisma.itemSize.findFirst({ where: { companyId: this.companyId, code: input.code } });
    if (duplicate) throw businessError(`Size Code "${input.code}" already exists.`);
    return prisma.itemSize.create({
      data: {
        companyId: this.companyId,
        code: input.code,
        name: input.name,
        description: input.description,
        notes: input.notes,
        sortOrder: input.sort_order,
        isActive: input.is_active,
      },
    });
  }

  async updateSize(input: UpdateSizeInput) {
    const { id, ...fields } = input;
    const existing = await prisma.itemSize.findFirst({ where: { id, companyId: this.companyId } });
    if (!existing) throw businessError('Size not found.', 404);
    if (fields.code && fields.code !== existing.code) {
      const duplicate = await prisma.itemSize.findFirst({ where: { companyId: this.companyId, code: fields.code } });
      if (duplicate) throw businessError(`Size Code "${fields.code}" is already used.`);
    }
    return prisma.itemSize.update({
      where: { id },
      data: {
        ...(fields.code !== undefined && { code: fields.code }),
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.description !== undefined && { description: fields.description }),
        ...(fields.notes !== undefined && { notes: fields.notes }),
        ...(fields.sort_order !== undefined && { sortOrder: fields.sort_order }),
        ...(fields.is_active !== undefined && { isActive: fields.is_active }),
      },
    });
  }

  async deleteSize(id: string) {
    const count = await prisma.inventoryItem.count({ where: { companyId: this.companyId, itemSizeId: id } });
    if (count > 0) throw businessError(`This Size cannot be deleted. ${count} product(s) use it.`);
    const deleted = await prisma.itemSize.deleteMany({ where: { id, companyId: this.companyId } });
    if (deleted.count === 0) throw businessError('Size not found.', 404);
  }

  /* ────────────────────────── ITEM COLORS ────────────────────────── */

  async listColors() {
    return prisma.itemColor.findMany({
      where: { companyId: this.companyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createColor(input: CreateColorInput) {
    const duplicate = await prisma.itemColor.findFirst({ where: { companyId: this.companyId, code: input.code } });
    if (duplicate) throw businessError(`Color Code "${input.code}" already exists.`);
    return prisma.itemColor.create({
      data: {
        companyId: this.companyId,
        code: input.code,
        name: input.name,
        hexCode: input.hex_code,
        description: input.description,
        notes: input.notes,
        sortOrder: input.sort_order,
        isActive: input.is_active,
      },
    });
  }

  async updateColor(input: UpdateColorInput) {
    const { id, ...fields } = input;
    const existing = await prisma.itemColor.findFirst({ where: { id, companyId: this.companyId } });
    if (!existing) throw businessError('Color not found.', 404);
    if (fields.code && fields.code !== existing.code) {
      const duplicate = await prisma.itemColor.findFirst({ where: { companyId: this.companyId, code: fields.code } });
      if (duplicate) throw businessError(`Color Code "${fields.code}" is already used.`);
    }
    return prisma.itemColor.update({
      where: { id },
      data: {
        ...(fields.code !== undefined && { code: fields.code }),
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.hex_code !== undefined && { hexCode: fields.hex_code }),
        ...(fields.description !== undefined && { description: fields.description }),
        ...(fields.notes !== undefined && { notes: fields.notes }),
        ...(fields.sort_order !== undefined && { sortOrder: fields.sort_order }),
        ...(fields.is_active !== undefined && { isActive: fields.is_active }),
      },
    });
  }

  async deleteColor(id: string) {
    const count = await prisma.inventoryItem.count({ where: { companyId: this.companyId, colorId: id } });
    if (count > 0) throw businessError(`This Color cannot be deleted. ${count} product(s) use it.`);
    const deleted = await prisma.itemColor.deleteMany({ where: { id, companyId: this.companyId } });
    if (deleted.count === 0) throw businessError('Color not found.', 404);
  }

  /* ────────────────────────── ORIGINS ────────────────────────── */

  async listOrigins() {
    return prisma.origin.findMany({
      where: { companyId: this.companyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createOrigin(input: CreateOriginInput) {
    const duplicate = await prisma.origin.findFirst({ where: { companyId: this.companyId, code: input.code } });
    if (duplicate) throw businessError(`Origin Code "${input.code}" already exists.`);
    return prisma.origin.create({
      data: {
        companyId: this.companyId,
        code: input.code,
        name: input.name,
        description: input.description,
        notes: input.notes,
        sortOrder: input.sort_order,
        isActive: input.is_active,
      },
    });
  }

  async updateOrigin(input: UpdateOriginInput) {
    const { id, ...fields } = input;
    const existing = await prisma.origin.findFirst({ where: { id, companyId: this.companyId } });
    if (!existing) throw businessError('Origin not found.', 404);
    if (fields.code && fields.code !== existing.code) {
      const duplicate = await prisma.origin.findFirst({ where: { companyId: this.companyId, code: fields.code } });
      if (duplicate) throw businessError(`Origin Code "${fields.code}" is already used.`);
    }
    return prisma.origin.update({
      where: { id },
      data: {
        ...(fields.code !== undefined && { code: fields.code }),
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.description !== undefined && { description: fields.description }),
        ...(fields.notes !== undefined && { notes: fields.notes }),
        ...(fields.sort_order !== undefined && { sortOrder: fields.sort_order }),
        ...(fields.is_active !== undefined && { isActive: fields.is_active }),
      },
    });
  }

  async deleteOrigin(id: string) {
    const count = await prisma.inventoryItem.count({ where: { companyId: this.companyId, originId: id } });
    if (count > 0) throw businessError(`This Origin cannot be deleted. ${count} product(s) use it.`);
    const deleted = await prisma.origin.deleteMany({ where: { id, companyId: this.companyId } });
    if (deleted.count === 0) throw businessError('Origin not found.', 404);
  }

  /* ────────────────────────── UNITS OF MEASURE ────────────────────────── */

  async listUom() {
    const rows = await prisma.unitOfMeasure.findMany({
      where: { companyId: this.companyId },
      orderBy: { name: 'asc' },
    });
    return rows.map(row => ({
      id: row.id,
      company_id: row.companyId,
      name: row.name,
      abbreviation: row.shortName,
      uom_type: uomTypeFromCode(row.shortName || row.code),
      is_active: row.isActive,
      is_default: row.isDefault,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }));
  }

  async createUom(input: CreateUomInput) {
    const duplicate = await prisma.unitOfMeasure.findFirst({ where: { companyId: this.companyId, shortName: input.abbreviation } });
    if (duplicate) throw businessError(`UOM Abbreviation "${input.abbreviation}" already exists.`);
    if (input.is_default) {
      await prisma.unitOfMeasure.updateMany({ where: { companyId: this.companyId, isDefault: true }, data: { isDefault: false } });
    }
    return prisma.unitOfMeasure.create({
      data: {
        companyId: this.companyId,
        code: input.abbreviation.toUpperCase(),
        shortName: input.abbreviation,
        name: input.name,
        isActive: input.is_active,
        isDefault: input.is_default,
      },
    });
  }

  async updateUom(input: UpdateUomInput) {
    const { id, ...fields } = input;
    const uom = await prisma.unitOfMeasure.findFirst({ where: { id, companyId: this.companyId } });
    if (!uom) throw businessError('UOM not found.', 404);
    if (fields.is_default) {
      await prisma.unitOfMeasure.updateMany({ where: { companyId: this.companyId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return prisma.unitOfMeasure.update({
      where: { id },
      data: {
        name: fields.name,
        shortName: fields.abbreviation,
        code: fields.abbreviation?.toUpperCase(),
        isActive: fields.is_active,
        isDefault: fields.is_default,
      },
    });
  }

  async deleteUom(id: string) {
    const count = await prisma.inventoryItem.count({
      where: {
        companyId: this.companyId,
        OR: [{ baseUomId: id }, { stockUomId: id }, { purchaseUomId: id }, { salesUomId: id }, { weightUomId: id }],
      },
    });
    if (count > 0) throw businessError(`This UOM cannot be deleted. ${count} product(s) use it.`);
    const deleted = await prisma.unitOfMeasure.deleteMany({ where: { id, companyId: this.companyId } });
    if (deleted.count === 0) throw businessError('UOM not found.', 404);
  }

  private async validateStockLevels(minimum?: number, maximum?: number) {
    if (minimum != null && maximum != null && minimum >= maximum) {
      throw businessError('Minimum Stock Level must be less than Maximum Stock Level.');
    }
  }

  private async findBrandId(name?: string) {
    if (!name?.trim()) return undefined;
    const brand = await prisma.brand.findFirst({ where: { companyId: this.companyId, name: name.trim() } });
    return brand?.id;
  }

  private async findUomIdByShortName(shortName?: string) {
    if (!shortName?.trim()) return undefined;
    const uom = await prisma.unitOfMeasure.findFirst({ where: { companyId: this.companyId, shortName: shortName.trim() } });
    return uom?.id;
  }

  private async replaceBarcodeAndImage(itemId: string, barcode?: string, imageUrl?: string) {
    if (barcode !== undefined) {
      await prisma.itemBarcode.updateMany({ where: { companyId: this.companyId, itemId }, data: { isActive: false } });
      if (barcode.trim()) {
        await prisma.itemBarcode.create({
          data: { companyId: this.companyId, itemId, barcode: barcode.trim(), isPrimary: true, isActive: true },
        });
      }
    }
    if (imageUrl !== undefined) {
      await prisma.itemImage.updateMany({ where: { companyId: this.companyId, itemId }, data: { isActive: false } });
      if (imageUrl.trim()) {
        await prisma.itemImage.create({
          data: { companyId: this.companyId, itemId, imageUrl: imageUrl.trim(), isPrimary: true, isActive: true },
        });
      }
    }
  }
}
