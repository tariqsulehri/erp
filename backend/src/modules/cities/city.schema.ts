import { z } from 'zod';

export const cityStatusEnum = z.enum(['All', 'Active', 'Inactive']);

export const listCitiesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  state_id: z.string().uuid().optional(),
  status: cityStatusEnum.default('All'),
});

export const createCitySchema = z.object({
  name: z.string().trim().min(1, 'City Name is required.').max(100),
  state_id: z.string().uuid('State is required.'),
  is_active: z.boolean().default(true),
});

export const updateCitySchema = createCitySchema.partial().extend({ id: z.string().uuid() });
export const idParams = z.object({ id: z.string().uuid() });

export type ListCitiesQuery = z.infer<typeof listCitiesQuery>;
export type CreateCityInput = z.infer<typeof createCitySchema>;
export type UpdateCityInput = z.infer<typeof updateCitySchema>;
