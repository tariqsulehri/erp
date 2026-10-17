import { z } from 'zod';

export const ledgerReportQuerySchema = z.object({
  account_id: z.string().uuid('Please select a valid Account.'),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date From must use YYYY-MM-DD format.'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date To must use YYYY-MM-DD format.'),
});

export type LedgerReportQuery = z.infer<typeof ledgerReportQuerySchema>;
