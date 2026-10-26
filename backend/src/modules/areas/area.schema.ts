import { z } from 'zod';

export const areaStatusEnum = z.enum(['All', 'Active', 'Inactive']);

export const listAreasQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  city_id: z.string().uuid().optional(),
  status: areaStatusEnum.default('All'),
});

export const createAreaSchema = z.object({
  name: z.string().trim().min(1, 'Area Name is required.').max(100),
  city_id: z.string().uuid('City is required.'),
  is_active: z.boolean().default(true),
});

export const updateAreaSchema = createAreaSchema.partial().extend({ id: z.string().uuid() });
export const idParams = z.object({ id: z.string().uuid() });

export type ListAreasQuery = z.infer<typeof listAreasQuery>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
