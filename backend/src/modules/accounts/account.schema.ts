import { z } from 'zod';

export const accountTypeSchema = z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
export const normalBalanceSchema = z.enum(['Debit', 'Credit']);

export const accountListQuerySchema = z.object({
  search: z.string().trim().optional(),
  type: z.string().trim().optional(),
  is_active: z.coerce.boolean().optional(),
  is_posting: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export const createAccountSchema = z.object({
  code: z.string().regex(/^\d{10}$/, 'Account Code must be exactly 10 digits.'),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  account_type: accountTypeSchema,
  normal_balance: normalBalanceSchema,
  is_posting: z.boolean().default(false),
  is_system: z.boolean().default(false),
  sort_order: z.number().int().optional(),
  category_id: z.string().uuid().optional().nullable(),
  opening_balance: z.number().min(0).optional().nullable(),
  opening_balance_date: z.string().trim().optional().nullable(),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  opening_balance: z.number().min(0).optional().nullable(),
  opening_balance_date: z.string().trim().optional().nullable(),
});

export const toggleAccountActiveSchema = z.object({
  is_active: z.boolean(),
});

export const bulkSetAccountActiveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  is_active: z.boolean(),
});

export const cloneAccountSchema = z.object({
  new_name: z.string().trim().min(1).max(100),
});

export const accountNextCodeQuerySchema = z.object({
  parent_code: z.string().regex(/^\d{10}$/),
  is_posting: z.coerce.boolean().optional().default(false),
});

export const accountChildrenQuerySchema = z.object({
  parent_code: z.string().regex(/^\d{10}$/),
});

export const validateAccountCodeQuerySchema = z.object({
  code: z.string().trim(),
});

export const bulkCreateAccountSchema = z.object({
  rows: z.array(createAccountSchema.pick({
    code: true,
    name: true,
    description: true,
    account_type: true,
    normal_balance: true,
    is_posting: true,
  })).min(1).max(500),
});

export const importAccountTemplateSchema = z.object({
  template_code: z.string().trim().min(1).max(50),
});

export type AccountListQuery = z.infer<typeof accountListQuerySchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type BulkCreateAccountInput = z.infer<typeof bulkCreateAccountSchema>;
