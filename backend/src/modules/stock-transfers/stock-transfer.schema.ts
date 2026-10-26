import { z } from 'zod';

const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.');

export const StockTransferLineInput = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero.'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});

const optionalId = z.string().uuid().optional().or(z.literal(''));

// Each side is exactly one Branch or one Warehouse: Warehouse -> Branch, Branch -> Branch,
// Warehouse -> Warehouse, or Branch -> Warehouse. A Location (shelf / rack) is optional.
export const ValidateStockTransferInput = z.object({
  transfer_date: dateInput,
  from_branch_id: optionalId,
  from_warehouse_id: optionalId,
  from_location_id: optionalId,
  to_branch_id: optionalId,
  to_warehouse_id: optionalId,
  to_location_id: optionalId,
  reference_number: z.string().trim().max(100).optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  lines: z.array(StockTransferLineInput).min(1, 'Add at least one transfer item.'),
});

export const ListStockTransfersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['Draft', 'Posted', 'Voided']).optional(),
  search: z.string().trim().optional(),
  from_branch_id: z.string().uuid().optional(),
  from_warehouse_id: z.string().uuid().optional(),
  to_branch_id: z.string().uuid().optional(),
  to_warehouse_id: z.string().uuid().optional(),
  date_from: dateInput.optional(),
  date_to: dateInput.optional(),
});

export const SupportDataQuery = z.object({
  from_branch_id: optionalId,
  from_warehouse_id: optionalId,
  from_location_id: optionalId,
});

export const SourceStockQuery = z.object({
  branch_id: optionalId,
  warehouse_id: optionalId,
  location_id: optionalId,
}).refine(value => Boolean(value.branch_id) !== Boolean(value.warehouse_id), { message: 'Select a Branch or a Warehouse.' });

export const idParams = z.object({ id: z.string().uuid() });

export type ValidateStockTransferInput = z.infer<typeof ValidateStockTransferInput>;
export type ListStockTransfersQuery = z.infer<typeof ListStockTransfersQuery>;
export type SupportDataQuery = z.infer<typeof SupportDataQuery>;
export type SourceStockQuery = z.infer<typeof SourceStockQuery>;
