import { z } from 'zod';

export const ledgerReportQuerySchema = z.object({
  account_id: z.string().uuid('Please select an Account.'),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date From must use YYYY-MM-DD format.'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date To must use YYYY-MM-DD format.'),
  limit: z.coerce.number().int().min(1).max(50000).optional(),
});

export type LedgerReportQuery = z.infer<typeof ledgerReportQuerySchema>;
