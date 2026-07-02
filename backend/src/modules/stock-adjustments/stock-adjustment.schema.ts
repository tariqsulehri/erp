import { z } from 'zod';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');

export const StockAdjustmentLineInput = z.object({
  adjustment_type: z.enum(['Increase', 'Decrease']),
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero.'),
  unit_cost: z.coerce.number().min(0, 'Unit Cost cannot be negative.').default(0),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});

export const ValidateStockAdjustmentInput = z.object({
  adjustment_date: dateInput,
  warehouse_id: z.string().uuid(),
  location_id: z.string().uuid().optional().or(z.literal('')),
  reference_number: z.string().trim().max(100).optional().or(z.literal('')),
  reason: z.string().trim().max(150).optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  lines: z.array(StockAdjustmentLineInput).min(1, 'Add at least one adjustment item.'),
});

export const ListStockAdjustmentsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['Draft', 'Posted', 'Voided']).optional(),
  search: z.string().trim().optional(),
  warehouse_id: z.string().uuid().optional(),
  adjustment_type: z.enum(['Increase', 'Decrease']).optional(),
  date_from: dateInput.optional(),
  date_to: dateInput.optional(),
});

export const idParams = z.object({ id: z.string().uuid() });

export type ValidateStockAdjustmentInput = z.infer<typeof ValidateStockAdjustmentInput>;
export type ListStockAdjustmentsQuery = z.infer<typeof ListStockAdjustmentsQuery>;
