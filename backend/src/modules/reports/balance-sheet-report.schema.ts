import { z } from 'zod';

const reportDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.');

export const balanceSheetReportQuerySchema = z.object({
  as_of_date: reportDate,
  include_zero_balances: z.preprocess(
    value => value === true || value === 'true' || value === '1',
    z.boolean(),
  ).default(false),
});

export type BalanceSheetReportQuery = z.infer<typeof balanceSheetReportQuerySchema>;
