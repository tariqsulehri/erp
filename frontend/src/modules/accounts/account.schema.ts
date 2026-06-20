import { z } from 'zod';
import { ACCOUNT_CODE_PATTERN } from './account-code';

/**
 * Account Zod Schemas
 * Used for validation in tRPC procedures and form submission
 */

const AccountTypeEnum = z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
const NormalBalanceEnum = z.enum(['Debit', 'Credit']);

/**
 * Account code validation — exactly 10 digits.
 *
 * Hierarchy is MM GG SS PPPP:
 *   0100000000 = Main Category  |  0101000000 = Group  |  0101100001 = Posting
 */
const AccountCodeSchema = z
  .string()
  .regex(ACCOUNT_CODE_PATTERN, 'Account Code must be exactly 10 digits')
  .describe('10-digit account code');

/**
 * Create Account Input
 */
export const CreateAccountInput = z.object({
  code:                 AccountCodeSchema,
  name:                 z.string().min(1).max(100).describe('Account name'),
  description:          z.string().max(500).optional().describe('Account description'),
  account_type:         AccountTypeEnum.describe('Account type'),
  normal_balance:       NormalBalanceEnum.describe('Normal balance direction'),
  is_posting:           z.boolean().default(false).describe('Can this account receive journal entries?'),
  is_system:            z.boolean().default(false).describe('Is this a system account?'),
  sort_order:           z.number().int().default(0).optional().describe('Display order'),
  category_id:          z.string().uuid().optional().describe('Category ID for grouping'),
  opening_balance:      z.number().optional().describe('Opening balance amount (posting accounts only)'),
  opening_balance_date: z.string().optional().describe('ISO date string for the opening balance'),
});

export type CreateAccountInput = z.infer<typeof CreateAccountInput>;

/**
 * Update Account Input
 * Cannot change code, type, or balance after creation
 */
export const UpdateAccountInput = z.object({
  name:                 z.string().min(1).max(100).optional(),
  description:          z.string().max(500).optional(),
  is_active:            z.boolean().optional(),
  sort_order:           z.number().int().optional(),
  opening_balance:      z.number().optional().describe('Opening balance amount'),
  opening_balance_date: z.string().optional().describe('ISO date string for opening balance'),
});

export type UpdateAccountInput = z.infer<typeof UpdateAccountInput>;

/**
 * Get Accounts Query
 */
export const GetAccountsQuery = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(1000).default(20),
  type: z.string().optional().describe('Filter by account type'),
  is_active: z.boolean().optional().describe('Filter by active status'),
  is_posting: z.boolean().optional().describe('Filter by posting status'),
  search: z.string().optional().describe('Search by code or name'),
});

export type GetAccountsQuery = z.infer<typeof GetAccountsQuery>;

/**
 * Account Response
 */
export const AccountResponse = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  account_type: AccountTypeEnum,
  normal_balance: NormalBalanceEnum,
  is_posting: z.boolean(),
  is_system: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().optional(),
  created_at: z.date(),
  updated_at: z.date(),
  created_by_user_id: z.string().uuid().optional(),
  updated_by_user_id: z.string().uuid().optional(),
});

export type AccountResponse = z.infer<typeof AccountResponse>;

/**
 * Account Hierarchy Node (recursive)
 */
export interface AccountHierarchyNode {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isPosting: boolean;
  children: AccountHierarchyNode[];
}

export const AccountHierarchyNode: z.ZodType<AccountHierarchyNode> = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  accountType: z.string(),
  isPosting: z.boolean(),
  children: z.lazy(() => AccountHierarchyNode.array()),
});

/**
 * Account Tree Response
 */
export const AccountTreeResponse = z.array(AccountHierarchyNode);

export type AccountTreeResponse = z.infer<typeof AccountTreeResponse>;

/**
 * Deactivate Account Input
 */
export const DeactivateAccountInput = z.object({
  id: z.string().uuid(),
});

export type DeactivateAccountInput = z.infer<typeof DeactivateAccountInput>;

/**
 * Get Account Balance Query
 */
export const GetAccountBalanceQuery = z.object({
  id: z.string().uuid(),
  periodEnd: z.date().optional(),
});

export type GetAccountBalanceQuery = z.infer<typeof GetAccountBalanceQuery>;
