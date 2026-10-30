import { z } from 'zod';

export const listAuditLogsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  search: z.string().trim().optional(),
  entity_name: z.string().trim().optional(),
  action: z.string().trim().optional(),
  category: z.string().trim().optional(),
  four_eyes: z.enum(['all', 'verified', 'single']).optional(),
  user_id: z.string().uuid().optional(),
  from_date: z.string().trim().optional(),
  to_date: z.string().trim().optional(),
});

export const createAuditLogInputSchema = z.object({
  action: z.string().trim().min(1).max(50),
  entity_name: z.string().trim().min(1).max(100),
  entity_id: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  details: z.record(z.any()).optional().nullable(),
  ip_address: z.string().trim().max(45).optional().nullable(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuery>;
export type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;
