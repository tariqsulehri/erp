import { z } from 'zod';

const accountCodePattern = /^\d{10}$/;

export const voucherTypeSchema = z.enum(['BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN', 'PI']);
export const voucherStatusSchema = z.enum(['Draft', 'Posted', 'Voided']);
export const voucherApprovalStatusSchema = z.enum(['Not Required', 'Pending', 'Approved', 'Rejected']);

export const voucherLineInputSchema = z.object({
  account_id: z.string().uuid(),
  account_code: z.string().regex(accountCodePattern, 'Account Code must be exactly 10 digits.'),
  account_name: z.string().trim().min(1).max(200),
  dr_amount: z.number().min(0).default(0),
  cr_amount: z.number().min(0).default(0),
  narration: z.string().trim().max(500).optional(),
  line_no: z.number().int().min(1).default(1),
  cost_center_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
});

export const createVoucherInputSchema = z.object({
  voucher_type: voucherTypeSchema,
  voucher_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.'),
  reference: z.string().trim().max(100).optional(),
  narration: z.string().trim().max(1000).optional(),
  auto_reverse_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.').optional(),
  submit_for_approval: z.boolean().optional().default(false),
  lines: z.array(voucherLineInputSchema).min(2, 'Minimum 2 lines are required.'),
});

export const listVouchersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  voucher_type: voucherTypeSchema.optional(),
  status: voucherStatusSchema.optional(),
  approval_status: voucherApprovalStatusSchema.optional(),
  search: z.string().trim().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  amount_from: z.coerce.number().min(0).optional(),
  amount_to: z.coerce.number().min(0).optional(),
});

export const voucherApprovalActionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const voucherRejectActionSchema = z.object({
  reason: z.string().trim().min(1, 'Rejection Reason is required.').max(500),
});

export type CreateVoucherInput = z.infer<typeof createVoucherInputSchema>;
export type ListVouchersQuery = z.infer<typeof listVouchersQuerySchema>;
export type VoucherApprovalActionInput = z.infer<typeof voucherApprovalActionSchema>;
export type VoucherRejectActionInput = z.infer<typeof voucherRejectActionSchema>;
