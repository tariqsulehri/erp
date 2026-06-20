import { z } from 'zod';

export const PurchasePaymentTypeEnum = z.enum(['Cash', 'Credit']);
export const PurchaseStatusEnum = z.enum(['Draft', 'Posted', 'Voided']);

const DateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format');

export const PurchaseInvoiceLineInput = z.object({
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid().optional(),
  quantity: z.number().positive('Quantity must be greater than zero.'),
  purchase_price: z.number().positive('Purchase Price must be greater than zero.'),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
});
export type PurchaseInvoiceLineInput = z.infer<typeof PurchaseInvoiceLineInput>;

export const CreatePurchaseInvoiceInput = z.object({
  purchase_date: DateInput,
  supplier_id: z.string().uuid(),
  supplier_invoice_number: z.string().max(100).optional(),
  supplier_invoice_date: DateInput.optional(),
  payment_type: PurchasePaymentTypeEnum,
  due_date: DateInput.optional(),
  warehouse_id: z.string().uuid(),
  reference_number: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  freight_amount: z.number().min(0).default(0),
  lines: z.array(PurchaseInvoiceLineInput).min(1, 'Add at least one purchase item.'),
});
export type CreatePurchaseInvoiceInput = z.infer<typeof CreatePurchaseInvoiceInput>;

export const ListPurchaseInvoicesQuery = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(20),
  status: PurchaseStatusEnum.optional(),
  supplier_id: z.string().uuid().optional(),
  payment_type: PurchasePaymentTypeEnum.optional(),
  warehouse_id: z.string().uuid().optional(),
  search: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  amount_from: z.number().min(0).optional(),
  amount_to: z.number().min(0).optional(),
});
export type ListPurchaseInvoicesQuery = z.infer<typeof ListPurchaseInvoicesQuery>;

export const PurchaseAnalyticsQuery = z.object({
  supplier_id: z.string().uuid().optional(),
  payment_type: PurchasePaymentTypeEnum.optional(),
  warehouse_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});
export type PurchaseAnalyticsQuery = z.infer<typeof PurchaseAnalyticsQuery>;
