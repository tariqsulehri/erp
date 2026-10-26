import { z } from 'zod';
import { ACCESS_LEVELS, USER_ROLES } from '../auth/access-rules.js';
import { newPasswordSchema } from '../auth/auth.schema.js';

const optionalId = z.string().uuid().optional().nullable().or(z.literal('')).transform(value => value || null);

export const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  status: z.enum(['All', 'Active', 'Inactive']).default('All'),
  role: z.enum(USER_ROLES).optional(),
});

export const createUserSchema = z.object({
  full_name: z.string().trim().min(1, 'Full Name is required.').max(150),
  email: z.string().trim().min(1, 'Email is required.').email('Email is not valid.').max(150).transform(value => value.toLowerCase()),
  password: newPasswordSchema,
  role: z.enum(USER_ROLES, { errorMap: () => ({ message: 'Please select a Role.' }) }),
  access_level: z.enum(ACCESS_LEVELS, { errorMap: () => ({ message: 'Please select an Access Level.' }) }),
  branch_id: optionalId,
  warehouse_id: optionalId,
  is_active: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.omit({ password: true }).partial().extend({ id: z.string().uuid() });

export const resetPasswordSchema = z.object({ new_password: newPasswordSchema });

export const idParams = z.object({ id: z.string().uuid() });

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
