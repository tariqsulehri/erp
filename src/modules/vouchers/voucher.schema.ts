import { z } from 'zod';

export const VoucherTypeEnum   = z.enum(['BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN']);
export const VoucherStatusEnum = z.enum(['Draft', 'Posted', 'Voided']);

export const VoucherLineInput = z.object({
  account_id:   z.string().uuid(),
  account_code: z.string(),
  account_name: z.string(),
  dr_amount:    z.number().min(0).default(0),
  cr_amount:    z.number().min(0).default(0),
  narration:    z.string().max(500).optional(),
  line_no:      z.number().int().min(1).default(1),
});
export type VoucherLineInput = z.infer<typeof VoucherLineInput>;

export const CreateVoucherInput = z.object({
  voucher_type: VoucherTypeEnum,
  voucher_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  reference:    z.string().max(100).optional(),
  narration:    z.string().max(1000).optional(),
  lines:        z.array(VoucherLineInput).min(2, 'Minimum 2 lines required'),
});
export type CreateVoucherInput = z.infer<typeof CreateVoucherInput>;

export const ListVouchersQuery = z.object({
  page:         z.number().int().min(1).default(1),
  limit:        z.number().int().min(1).max(200).default(20),
  voucher_type: VoucherTypeEnum.optional(),
  status:       VoucherStatusEnum.optional(),
  search:       z.string().optional(),
  date_from:    z.string().optional(),
  date_to:      z.string().optional(),
});
export type ListVouchersQuery = z.infer<typeof ListVouchersQuery>;
