import { z } from 'zod';

/* ── Enums ─────────────────────────────────────────────────────── */
export const ProductTypeEnum   = z.enum(['Finished', 'RawMaterial', 'SemiFinished', 'Service', 'Consumable']);
export const ProductStatusEnum = z.enum(['Active', 'Inactive', 'Discontinued']);
export const TaxCategoryEnum   = z.enum(['Standard', 'Zero-Rated', 'Exempt']);
export const UomTypeEnum       = z.enum(['Quantity', 'Weight', 'Volume', 'Length', 'Area', 'Time', 'Other']);

/* ── Product Category ──────────────────────────────────────────── */
export const CreateCategoryInput = z.object({
  code:        z.string().min(1).max(20).toUpperCase(),
  name:        z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  parent_id:   z.string().uuid().optional(),
  sort_order:  z.number().int().default(0),
  is_active:   z.boolean().default(true),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInput>;

export const UpdateCategoryInput = CreateCategoryInput.partial().extend({ id: z.string().uuid() });
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInput>;

/* ── Unit of Measure ────────────────────────────────────────────── */
export const CreateUomInput = z.object({
  name:         z.string().min(1).max(80),
  abbreviation: z.string().min(1).max(20),
  uom_type:     UomTypeEnum,
  is_active:    z.boolean().default(true),
  is_default:   z.boolean().default(false),
});
export type CreateUomInput = z.infer<typeof CreateUomInput>;

export const UpdateUomInput = CreateUomInput.partial().extend({ id: z.string().uuid() });
export type UpdateUomInput = z.infer<typeof UpdateUomInput>;

/* ── Product ────────────────────────────────────────────────────── */
export const CreateProductInput = z.object({
  /* Identification */
  sku:         z.string().min(1).max(60),
  barcode:     z.string().max(100).optional(),
  name:        z.string().min(1).max(250),
  description: z.string().max(2000).optional(),
  brand:       z.string().max(100).optional(),
  model:       z.string().max(100).optional(),

  /* Classification */
  category_id:  z.string().uuid().optional(),
  uom_id:       z.string().uuid().optional(),
  product_type: ProductTypeEnum,
  status:       ProductStatusEnum.default('Active'),
  is_sellable:    z.boolean().default(true),
  is_purchasable: z.boolean().default(true),

  /* Pricing */
  cost_price:    z.number().min(0).default(0),
  sale_price:    z.number().min(0).default(0),
  min_sale_price:z.number().min(0).optional(),
  tax_category:  TaxCategoryEnum.default('Standard'),
  tax_rate:      z.number().min(0).max(100).default(0),

  /* Stock control */
  qty_on_hand:    z.number().default(0),
  min_stock_level:z.number().min(0).optional(),
  max_stock_level:z.number().min(0).optional(),
  reorder_qty:    z.number().min(0).optional(),
  track_inventory:z.boolean().default(true),

  /* Physical */
  weight:     z.number().min(0).optional(),
  weight_unit:z.string().max(10).optional(),
  length_cm:  z.number().min(0).optional(),
  width_cm:   z.number().min(0).optional(),
  height_cm:  z.number().min(0).optional(),

  /* Meta */
  image_url:  z.string().url().optional().or(z.literal('')),
  notes:      z.string().max(2000).optional(),
  tags:       z.string().max(500).optional(),
  sort_order: z.number().int().default(0),
});
export type CreateProductInput = z.infer<typeof CreateProductInput>;

export const UpdateProductInput = CreateProductInput.partial().extend({ id: z.string().uuid() });
export type UpdateProductInput = z.infer<typeof UpdateProductInput>;

export const ListProductsQuery = z.object({
  page:         z.number().int().min(1).default(1),
  limit:        z.number().int().min(1).max(200).default(50),
  search:       z.string().optional(),
  category_id:  z.string().uuid().optional(),
  product_type: ProductTypeEnum.optional(),
  status:       ProductStatusEnum.optional(),
  is_sellable:  z.boolean().optional(),
  low_stock:    z.boolean().optional(),  // filter: qty_on_hand < min_stock_level
  sort_by:      z.enum(['name', 'sku', 'sale_price', 'qty_on_hand', 'created_at']).default('name'),
  sort_dir:     z.enum(['ASC', 'DESC']).default('ASC'),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuery>;
