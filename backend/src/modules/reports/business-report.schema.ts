import { z } from 'zod';

const reportDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

const dateRange = {
  date_from: reportDate,
  date_to: reportDate,
};

export const dayBookQuerySchema = z.object({
  ...dateRange,
  voucher_type: z.string().trim().max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const agingQuerySchema = z.object({
  kind: z.enum(['receivables', 'payables']),
  as_of_date: reportDate,
});

export const salesTaxQuerySchema = z.object(dateRange);

export const stockLedgerQuerySchema = z.object({
  ...dateRange,
  item_id: z.string().uuid(),
  branch_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
});

export const stockValuationQuerySchema = z.object({
  as_of_date: reportDate,
  branch_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
});

export const bookAccountsQuerySchema = z.object({
  kind: z.enum(['cash', 'bank', 'customer', 'supplier']),
  search: z.string().trim().max(100).optional(),
});

export type DayBookQuery = z.infer<typeof dayBookQuerySchema>;
export type AgingQuery = z.infer<typeof agingQuerySchema>;
export type SalesTaxQuery = z.infer<typeof salesTaxQuerySchema>;
export type StockLedgerQuery = z.infer<typeof stockLedgerQuerySchema>;
export type StockValuationQuery = z.infer<typeof stockValuationQuerySchema>;
export type BookAccountsQuery = z.infer<typeof bookAccountsQuerySchema>;
