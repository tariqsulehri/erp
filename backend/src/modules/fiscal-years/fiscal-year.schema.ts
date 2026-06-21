import { z } from 'zod';

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');

export const listFiscalYearsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createFiscalYearSchema = z.object({
  fiscal_year: z.string().trim().min(1, 'Fiscal Year is required.').max(50),
  year_basis: z.enum(['calendar', 'july', 'april']).default('calendar'),
  start_date: dateText,
  end_date: dateText,
  number_of_periods: z.coerce.number().int().min(1).max(13).default(12),
  posting_cutoff_days: z.coerce.number().int().min(0).max(60).default(0),
});

export const fiscalYearIdParams = z.object({
  id: z.string().uuid(),
});

export const periodIdParams = z.object({
  id: z.string().uuid(),
});

