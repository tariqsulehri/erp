import { z } from 'zod';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');

export const StockTransferLineInput = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero.'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});

export const ValidateStockTransferInput = z.object({
  transfer_date: dateInput,
  from_warehouse_id: z.string().uuid(),
  from_location_id: z.string().uuid().optional().or(z.literal('')),
  to_warehouse_id: z.string().uuid(),
  to_location_id: z.string().uuid().optional().or(z.literal('')),
  reference_number: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  lines: z.array(StockTransferLineInput).min(1, 'Add at least one transfer item.'),
});

export const ListStockTransfersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['Draft', 'Posted', 'Voided']).optional(),
  search: z.string().trim().optional(),
  from_warehouse_id: z.string().uuid().optional(),
  to_warehouse_id: z.string().uuid().optional(),
  date_from: dateInput.optional(),
  date_to: dateInput.optional(),
});

export const idParams = z.object({ id: z.string().uuid() });

export type ValidateStockTransferInput = z.infer<typeof ValidateStockTransferInput>;
export type ListStockTransfersQuery = z.infer<typeof ListStockTransfersQuery>;
