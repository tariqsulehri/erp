import { z } from 'zod';

export const warehouseStatusEnum = z.enum(['All', 'Active', 'Inactive']);

export const listWarehousesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  status: warehouseStatusEnum.default('All'),
});

export const listWarehouseStockQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
});

export const createWarehouseSchema = z.object({
  code: z.string().trim().min(1, 'Warehouse Code is required.').max(30).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Warehouse Name is required.').max(150),
  branch_id: z.string().uuid().optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  address: z.string().trim().max(1000).optional().or(z.literal('')),
  is_default: z.boolean().default(false),
  use_locations: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const updateWarehouseSchema = createWarehouseSchema.partial().extend({ id: z.string().uuid() });

export const createWarehouseLocationSchema = z.object({
  code: z.string().trim().min(1, 'Location Code is required.').max(30).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Location Name is required.').max(150),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const updateWarehouseLocationSchema = createWarehouseLocationSchema.partial().extend({
  id: z.string().uuid(),
});

export const idParams = z.object({ id: z.string().uuid() });
export const locationIdParams = z.object({ locationId: z.string().uuid() });

export type ListWarehousesQuery = z.infer<typeof listWarehousesQuery>;
export type ListWarehouseStockQuery = z.infer<typeof listWarehouseStockQuery>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type CreateWarehouseLocationInput = z.infer<typeof createWarehouseLocationSchema>;
export type UpdateWarehouseLocationInput = z.infer<typeof updateWarehouseLocationSchema>;
