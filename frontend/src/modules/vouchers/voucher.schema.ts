import { z } from 'zod';
import { ACCOUNT_CODE_PATTERN } from '@/modules/accounts/account-code';

export const VoucherTypeEnum   = z.enum(['BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN', 'PI']);
export const VoucherStatusEnum = z.enum(['Draft', 'Posted', 'Voided']);
export const ApprovalStatusEnum = z.enum(['Not Required', 'Pending', 'Approved', 'Rejected']);

export const VoucherLineInput = z.object({
  account_id:   z.string().uuid(),
  account_code: z.string().regex(ACCOUNT_CODE_PATTERN, 'Account Code must be exactly 10 digits'),
  account_name: z.string(),
  dr_amount:    z.number().min(0).default(0),
  cr_amount:    z.number().min(0).default(0),
  narration:    z.string().max(500).optional(),
  line_no:      z.number().int().min(1).default(1),
  cost_center_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
});
export type VoucherLineInput = z.infer<typeof VoucherLineInput>;

export const CreateVoucherInput = z.object({
  voucher_type: VoucherTypeEnum,
  voucher_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  reference:    z.string().max(100).optional(),
  narration:    z.string().max(1000).optional(),
  approval_status: ApprovalStatusEnum.default('Not Required').optional(),
  auto_reverse_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
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
