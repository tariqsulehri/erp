import { z } from 'zod';

export const productTypeEnum = z.enum(['Finished', 'RawMaterial', 'SemiFinished', 'Service', 'Consumable']);
export const productStatusEnum = z.enum(['Active', 'Inactive', 'Discontinued']);
export const taxCategoryEnum = z.enum(['Standard', 'Zero-Rated', 'Exempt']);
export const uomTypeEnum = z.enum(['Quantity', 'Weight', 'Volume', 'Length', 'Area', 'Time', 'Other']);

export const listProductsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  category_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  product_type: productTypeEnum.optional(),
  status: productStatusEnum.optional(),
  is_sellable: z.coerce.boolean().optional(),
  low_stock: z.coerce.boolean().optional(),
  stock_filter: z.enum(['need_order', 'below_minimum', 'at_or_below_reorder', 'out_of_stock']).optional(),
  sort_by: z.enum(['name', 'sku', 'sale_price', 'qty_on_hand', 'created_at']).default('name'),
  sort_dir: z.enum(['ASC', 'DESC']).default('ASC'),
});

export const createCategorySchema = z.object({
  code: z.string().trim().min(1).max(30).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1).max(150),
  description: z.string().max(500).optional(),
  parent_id: z.string().uuid().optional(),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial().extend({ id: z.string().uuid() });

export const createUomSchema = z.object({
  name: z.string().trim().min(1).max(120),
  abbreviation: z.string().trim().min(1).max(20),
  uom_type: uomTypeEnum,
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

export const updateUomSchema = createUomSchema.partial().extend({ id: z.string().uuid() });

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  barcode: z.string().max(100).optional(),
  name: z.string().trim().min(1).max(250),
  description: z.string().max(2000).optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  category_id: z.string().uuid().optional(),
  uom_id: z.string().uuid().optional(),
  product_type: productTypeEnum,
  status: productStatusEnum.default('Active'),
  is_sellable: z.boolean().default(true),
  is_purchasable: z.boolean().default(true),
  cost_price: z.coerce.number().min(0).default(0),
  sale_price: z.coerce.number().min(0).default(0),
  min_sale_price: z.coerce.number().min(0).optional(),
  tax_category: taxCategoryEnum.default('Standard'),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  qty_on_hand: z.coerce.number().default(0),
  min_stock_level: z.coerce.number().min(0).optional(),
  max_stock_level: z.coerce.number().min(0).optional(),
  reorder_qty: z.coerce.number().min(0).optional(),
  track_inventory: z.boolean().default(true),
  weight: z.coerce.number().min(0).optional(),
  weight_unit: z.string().max(10).optional(),
  length_cm: z.coerce.number().min(0).optional(),
  width_cm: z.coerce.number().min(0).optional(),
  height_cm: z.coerce.number().min(0).optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
  tags: z.string().max(500).optional(),
  sort_order: z.coerce.number().int().default(0),
});

export const updateProductSchema = createProductSchema.partial().extend({ id: z.string().uuid() });

export const idParams = z.object({ id: z.string().uuid() });
export const suggestSkuQuery = z.object({ prefix: z.string().optional() });

export type ListProductsQuery = z.infer<typeof listProductsQuery>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateUomInput = z.infer<typeof createUomSchema>;
export type UpdateUomInput = z.infer<typeof updateUomSchema>;

