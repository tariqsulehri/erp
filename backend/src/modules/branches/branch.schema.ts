import { z } from 'zod';

export const branchStatusEnum = z.enum(['All', 'Active', 'Inactive']);

export const listBranchesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  status: branchStatusEnum.default('All'),
});

export const createBranchSchema = z.object({
  code: z.string().trim().min(1, 'Branch Code is required.').max(30).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Branch Name is required.').max(150),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  address: z.string().trim().max(1000).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email('Email is not valid.').optional().or(z.literal('')),
  manager_name: z.string().trim().max(150).optional().or(z.literal('')),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const updateBranchSchema = createBranchSchema.partial().extend({ id: z.string().uuid() });
export const idParams = z.object({ id: z.string().uuid() });

export type ListBranchesQuery = z.infer<typeof listBranchesQuery>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
