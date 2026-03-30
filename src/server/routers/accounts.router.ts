import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { AccountService } from '@/modules/accounts/account.service';
import { COATemplateService } from '@/modules/accounts/coa-template.service';
import {
  CreateAccountInput,
  UpdateAccountInput,
  GetAccountsQuery,
  AccountResponse,
  DeactivateAccountInput,
  GetAccountBalanceQuery,
} from '@/modules/accounts/account.schema';

/**
 * Accounts Router — tRPC API for Chart of Accounts
 * All procedures require authentication and scoped to current company
 */
export const accountsRouter = router({
  /**
   * Get all accounts with pagination and filtering
   */
  list: protectedProcedure
    .input(GetAccountsQuery)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);

      const { data, total, page, limit } = await service.getAccounts(
        input.page,
        input.limit,
        {
          type:      input.type,
          is_active: input.is_active,
          is_posting: input.is_posting,
          search:    input.search,
        },
      );

      return {
        data,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      };
    }),

  /**
   * Get single account by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);
      const account = await service.getAccountById(input.id);

      if (!account) {
        throw new Error('Account not found');
      }

      return account;
    }),

  /**
   * Get single account by code
   */
  getByCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);
      const account = await service.getAccountByCode(input.code);

      if (!account) {
        throw new Error(`Account ${input.code} not found`);
      }

      return account;
    }),

  /**
   * Get full account hierarchy (tree structure)
   * For sidebar navigation and report grouping
   */
  getHierarchy: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new AccountService(ctx.company_id);
      return service.getHierarchy();
    }),

  /**
   * Get posting accounts only
   * These are the accounts that can receive journal entries
   * Used for dropdowns in voucher entry
   */
  getPosting: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new AccountService(ctx.company_id);
      return service.getPostingAccounts();
    }),

  /**
   * Get account hierarchy path (parent and ancestors)
   */
  getHierarchyPath: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);
      return service.getAccountHierarchy(input.code);
    }),

  /**
   * Get account balance (requires GL to be implemented)
   */
  getBalance: protectedProcedure
    .input(GetAccountBalanceQuery)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);
      const balance = await service.getAccountBalance(input.id, input.periodEnd);
      return { balance };
    }),

  /**
   * Create new account
   * Requires accountant or admin role
   */
  create: protectedProcedure
    .input(CreateAccountInput)
    .mutation(async ({ ctx, input }) => {
      // Check authorization
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can create accounts');
      }

      const service = new AccountService(ctx.company_id);

      try {
        const account = await service.createAccount(input);
        return {
          success: true,
          account,
          message: `Account ${input.code} created successfully`,
        };
      } catch (error) {
        throw new Error((error as any).message || 'Failed to create account');
      }
    }),

  /**
   * Update account details
   * Cannot change code, type, or balance
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: UpdateAccountInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check authorization
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can update accounts');
      }

      const service = new AccountService(ctx.company_id);

      try {
        const account = await service.updateAccount(input.id, input.data);
        return {
          success: true,
          account,
          message: 'Account updated successfully',
        };
      } catch (error) {
        throw new Error((error as any).message || 'Failed to update account');
      }
    }),

  /**
   * Deactivate (soft delete) an account
   * Cannot deactivate system accounts or accounts with active children
   */
  deactivate: protectedProcedure
    .input(DeactivateAccountInput)
    .mutation(async ({ ctx, input }) => {
      // Check authorization
      if (!['admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only admins can deactivate accounts');
      }

      const service = new AccountService(ctx.company_id);

      try {
        await service.deactivateAccount(input.id);
        return {
          success: true,
          message: 'Account deactivated successfully',
        };
      } catch (error) {
        throw new Error((error as any).message || 'Failed to deactivate account');
      }
    }),

  /**
   * Validate account code
   * Called during form input to check format
   */
  validateCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);
      const validation = service.validateAccountCode(input.code);

      if (!validation.valid) {
        return { valid: false, error: validation.error };
      }

      // Check uniqueness
      const exists = await service.getAccountByCode(input.code);
      if (exists) {
        return { valid: false, error: 'This account code already exists' };
      }

      return { valid: true };
    }),

  /**
   * Get full audit history for an account
   */
  getHistory: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);
      return service.getAccountHistory(input.accountId);
    }),

  /**
   * Clone an account into the next available slot under the same parent
   */
  clone: protectedProcedure
    .input(z.object({
      sourceId: z.string().uuid(),
      newName:  z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can create accounts');
      }
      const service = new AccountService(ctx.company_id);
      const account = await service.cloneAccount(input.sourceId, input.newName);
      return { success: true, account, message: `Cloned as ${account.code}` };
    }),

  /**
   * Bulk-create accounts from CSV import.
   * Returns per-row success/failure so the UI can show a results table.
   */
  bulkCreate: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        code:           z.string().regex(/^\d{4}$/),
        name:           z.string().min(1).max(100),
        account_type:   z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
        normal_balance: z.enum(['Debit', 'Credit']),
        is_posting:     z.boolean(),
        description:    z.string().max(500).optional(),
      })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can bulk-create accounts');
      }
      const service = new AccountService(ctx.company_id);
      const results = await service.bulkCreateAccounts(input.rows);
      const created = results.filter(r => r.success && r.message === 'Created').length;
      const skipped = results.filter(r => r.success && r.message !== 'Created').length;
      const failed  = results.filter(r => !r.success).length;
      return { results, created, skipped, failed };
    }),

  /**
   * Toggle a single account's active status
   */
  toggleActive: protectedProcedure
    .input(z.object({ id: z.string().uuid(), is_active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can update accounts');
      }
      const service = new AccountService(ctx.company_id);
      const account = await service.getAccountById(input.id);
      if (!account) throw new Error('Account not found');
      if (account.is_system) throw new Error('System accounts cannot be modified');
      const updated = await service.updateAccount(input.id, { is_active: input.is_active });
      return { success: true, account: updated };
    }),

  /**
   * Bulk activate / deactivate a list of accounts.
   * Skips system accounts and accounts that cannot be deactivated.
   */
  bulkSetActive: protectedProcedure
    .input(z.object({
      ids:       z.array(z.string().uuid()).min(1).max(200),
      is_active: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can bulk-update accounts');
      }
      const service = new AccountService(ctx.company_id);
      const count = await service.bulkSetActive(input.ids, input.is_active);
      return {
        success: true,
        updated: count,
        message: `${count} account(s) ${input.is_active ? 'activated' : 'deactivated'}`,
      };
    }),

  /**
   * Get top-level category accounts (X000) for the wizard Step 1
   */
  getTopLevel: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new AccountService(ctx.company_id);
      return service.getTopLevelAccounts();
    }),

  /**
   * Get direct children of a parent account for wizard Steps 2 and 3
   */
  getChildren: protectedProcedure
    .input(z.object({ parentCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);
      return service.getChildAccounts(input.parentCode);
    }),

  /**
   * Get the next available code under a parent account for the wizard
   */
  getNextCode: protectedProcedure
    .input(z.object({ parentCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new AccountService(ctx.company_id);
      const code = await service.getNextAvailableCode(input.parentCode);
      return { code };
    }),

  /**
   * List all available COA templates
   * Used to populate the Import Template picker modal
   */
  listTemplates: protectedProcedure
    .query(async () => {
      const svc = new COATemplateService();
      const templates = await svc.getTemplates();
      return templates.map((t) => ({
        id:           t.id,
        code:         t.template_code,
        name:         t.template_name,
        description:  t.description,
        accountCount: t.account_count,
      }));
    }),

  /**
   * Import all accounts from a COA template into the current company.
   * Skips accounts whose code already exists (idempotent).
   * Requires admin role.
   */
  importTemplate: protectedProcedure
    .input(z.object({ templateCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!['admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only admins can import COA templates');
      }

      const svc = new COATemplateService();
      const accounts = await svc.instantiateTemplate(ctx.company_id, input.templateCode);
      return {
        success: true,
        imported: accounts.length,
        message: `Imported ${accounts.length} accounts from template`,
      };
    }),
});
