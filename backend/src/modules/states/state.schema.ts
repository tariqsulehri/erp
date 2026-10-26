import { z } from 'zod';

export const stateStatusEnum = z.enum(['All', 'Active', 'Inactive']);

export const listStatesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  status: stateStatusEnum.default('All'),
});

export const createStateSchema = z.object({
  name: z.string().trim().min(1, 'State Name is required.').max(100),
  is_active: z.boolean().default(true),
});

export const updateStateSchema = createStateSchema.partial().extend({ id: z.string().uuid() });
export const idParams = z.object({ id: z.string().uuid() });

export type ListStatesQuery = z.infer<typeof listStatesQuery>;
export type CreateStateInput = z.infer<typeof createStateSchema>;
export type UpdateStateInput = z.infer<typeof updateStateSchema>;
