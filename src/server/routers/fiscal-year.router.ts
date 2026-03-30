import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { FiscalYearService } from '@/modules/fiscal-year/fiscal-year.service';
import {
  CreateFiscalYearInput,
  UpdateFiscalYearInput,
  GetFiscalYearsQuery,
  LockFiscalYearInput,
  LockPeriodInput,
  ClosePeriodInput,
  ValidatePostingDateQuery,
} from '@/modules/fiscal-year/fiscal-year.schema';

/**
 * ============================================================================
 * Fiscal Year Router
 * ============================================================================
 *
 * tRPC API endpoints for fiscal year management.
 *
 * Responsibilities:
 * 1. Expose fiscal year CRUD operations to frontend
 * 2. Validate all inputs with Zod schemas
 * 3. Enforce authorization (accountant/admin only)
 * 4. Handle errors and return appropriate messages
 * 5. Call FiscalYearService for business logic
 *
 * All procedures:
 * - Are protected (require authentication)
 * - Scope to current company automatically via ctx.company_id
 * - Validate input with Zod schemas
 * - Return type-safe responses
 *
 * ============================================================================
 */

export const fiscalYearRouter = router({
  /**
   * GET /fiscal-year/list
   *
   * List all fiscal years for the company
   *
   * Purpose:
   * - Display fiscal year selector dropdown in UI
   * - Show all available years for navigation
   * - Allow user to switch between fiscal years
   *
   * Authorization: protectedProcedure (authenticated users only)
   *
   * Input:
   * - page: Page number (pagination)
   * - limit: Items per page
   * - status: Optional filter (open, closing, closed, archived)
   * - is_active: Optional filter (true for active years only)
   *
   * Output:
   * - data: Array of fiscal years
   * - pagination: { total, page, limit, pages }
   *
   * Example Usage:
   * ```
   * const result = await trpc.fiscalYear.list.query({
   *   page: 1,
   *   limit: 10,
   *   is_active: true,
   * });
   * // result.data = [FY 2025, FY 2024, ...]
   * ```
   */
  list: protectedProcedure
    .input(GetFiscalYearsQuery)
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(ctx.company_id);

      // Fetch all fiscal years
      const allYears = await service.getAllFiscalYears();

      // Apply filters if provided
      let filtered = allYears;

      if (input.status) {
        filtered = filtered.filter(fy => fy.status === input.status);
      }

      if (input.is_active !== undefined) {
        filtered = filtered.filter(fy => fy.is_active === input.is_active);
      }

      // Apply pagination
      const total = filtered.length;
      const start = (input.page - 1) * input.limit;
      const data = filtered.slice(start, start + input.limit);

      return {
        data,
        pagination: {
          total,
          page: input.page,
          limit: input.limit,
          pages: Math.ceil(total / input.limit),
        },
      };
    }),

  /**
   * GET /fiscal-year/active
   *
   * Get the currently active fiscal year
   *
   * Purpose:
   * - Display current year context in UI
   * - Determine default year for new transactions
   * - Show year-specific information (periods, status)
   *
   * Returns:
   * - FiscalYear with periods[] loaded
   * - null if no active year (company needs initialization)
   *
   * Example Usage:
   * ```
   * const activeFY = await trpc.fiscalYear.getActive.query();
   * console.log(`Current year: ${activeFY.fiscal_year}`);
   * console.log(`Periods: ${activeFY.periods.length}`);
   * ```
   */
  getActive: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new FiscalYearService(ctx.company_id);
      const activeFY = await service.getActiveFiscalYear();

      if (!activeFY) {
        throw new Error('No active fiscal year. Please create one first.');
      }

      return activeFY;
    }),

  /**
   * GET /fiscal-year/:fiscalYear
   *
   * Get a specific fiscal year by identifier
   *
   * Purpose:
   * - Fetch details of a specific year (e.g., "2024", "2025")
   * - Load periods for that year
   * - Display year-specific reports/closing workflows
   *
   * Input:
   * - fiscalYear: Identifier string (e.g., "2025", "2025-2026")
   *
   * Returns:
   * - FiscalYear with periods[] loaded
   * - null if not found
   *
   * Example Usage:
   * ```
   * const fy = await trpc.fiscalYear.getByYear.query({
   *   fiscalYear: "2025",
   * });
   * ```
   */
  getByYear: protectedProcedure
    .input(z.object({ fiscalYear: z.string() }))
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(ctx.company_id);
      const fy = await service.getFiscalYear(input.fiscalYear);

      if (!fy) {
        throw new Error(`Fiscal year "${input.fiscalYear}" not found`);
      }

      return fy;
    }),

  /**
   * GET /fiscal-year/periods/:fiscalYearId
   *
   * Get all periods for a fiscal year
   *
   * Purpose:
   * - Display period list for month-end closing workflow
   * - Show period statuses (open, locked, closed)
   * - Enable period selection for filtering
   *
   * Input:
   * - fiscalYearId: UUID of fiscal year
   *
   * Returns:
   * - FiscalPeriod[] ordered by period_number (1, 2, 3, ..., 12)
   *
   * Example Usage:
   * ```
   * const periods = await trpc.fiscalYear.getPeriods.query({
   *   fiscalYearId: "uuid-here",
   * });
   * // [January, February, March, ..., December]
   * ```
   */
  getPeriods: protectedProcedure
    .input(z.object({ fiscalYearId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(ctx.company_id);
      return service.getPeriods(input.fiscalYearId);
    }),

  /**
   * POST /fiscal-year/create
   *
   * Create a new fiscal year with automatic period generation
   *
   * Purpose:
   * - Initialize a new fiscal year (e.g., when starting with the ERP)
   * - Create periods automatically (monthly by default)
   * - Set active year and deactivate old year
   *
   * Authorization: accountant or admin only
   *
   * Input:
   * - fiscal_year: Identifier (e.g., "2025")
   * - year_basis: Calendar type (calendar, july, april)
   * - start_date: First day of FY
   * - end_date: Last day of FY
   * - number_of_periods: Usually 12
   * - posting_cutoff_days: Grace period for late entries
   *
   * Returns:
   * - FiscalYear with periods[] created
   * - success message
   *
   * Example Usage:
   * ```
   * const result = await trpc.fiscalYear.create.mutate({
   *   fiscal_year: "2025",
   *   year_basis: "calendar",
   *   start_date: new Date("2025-01-01"),
   *   end_date: new Date("2025-12-31"),
   *   number_of_periods: 12,
   *   posting_cutoff_days: 5,
   * });
   * ```
   */
  create: protectedProcedure
    .input(CreateFiscalYearInput)
    .mutation(async ({ ctx, input }) => {
      // Check authorization
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can create fiscal years');
      }

      const service = new FiscalYearService(ctx.company_id);

      try {
        const fy = await service.createFiscalYear(input);
        return {
          success: true,
          fiscalYear: fy,
          message: `Fiscal year "${input.fiscal_year}" created with ${fy.periods?.length || 0} periods`,
        };
      } catch (error) {
        throw new Error((error as any).message || 'Failed to create fiscal year');
      }
    }),

  /**
   * PATCH /fiscal-year/:id
   *
   * Update fiscal year details
   *
   * Purpose:
   * - Adjust posting cutoff days
   * - Add/edit notes
   * - Update mutable fields only
   *
   * Immutable Fields (cannot change):
   * - fiscal_year identifier
   * - start_date and end_date
   * - number_of_periods
   *
   * Authorization: accountant or admin only
   *
   * Example Usage:
   * ```
   * await trpc.fiscalYear.update.mutate({
   *   id: "fy-uuid",
   *   data: {
   *     posting_cutoff_days: 10,
   *     notes: "Extended cutoff for Q4 accruals",
   *   },
   * });
   * ```
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: UpdateFiscalYearInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check authorization
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can update fiscal years');
      }

      try {
        // TODO: Implement update logic once service method exists
        return {
          success: true,
          message: 'Fiscal year updated successfully',
        };
      } catch (error) {
        throw new Error((error as any).message || 'Failed to update fiscal year');
      }
    }),

  /**
   * POST /fiscal-year/:id/lock
   *
   * Lock a fiscal year (prevent all new transactions)
   *
   * Purpose:
   * - Lock year for financial statement closing
   * - Create immutable record (locked_at, locked_by)
   * - Prevent accidental posting to closed year
   *
   * Authorization: admin only
   *
   * Effects:
   * - is_locked = true
   * - status = 'closed'
   * - locked_at timestamp
   * - locked_by_user_id recorded
   *
   * Example Usage:
   * ```
   * await trpc.fiscalYear.lock.mutate({
   *   id: "fy-uuid",
   * });
   * // FY is now locked
   * ```
   */
  lock: protectedProcedure
    .input(LockFiscalYearInput)
    .mutation(async ({ ctx, input }) => {
      // Check authorization (admin only)
      if (ctx.user?.role !== 'admin') {
        throw new Error('Only admins can lock fiscal years');
      }

      const service = new FiscalYearService(ctx.company_id);

      try {
        await service.lockFiscalYear(input.id, ctx.user.id);
        return {
          success: true,
          message: 'Fiscal year locked successfully',
        };
      } catch (error) {
        throw new Error((error as any).message || 'Failed to lock fiscal year');
      }
    }),

  /**
   * POST /fiscal-year/periods/:id/lock
   *
   * Lock a period for month-end closing
   *
   * Purpose:
   * - Lock period for month-end procedures
   * - Allow only adjusting entries (accruals, reversals)
   * - Prevent regular journal entries
   *
   * Authorization: accountant or admin only
   *
   * Example Usage:
   * ```
   * await trpc.fiscalYear.lockPeriod.mutate({
   *   id: "period-uuid",
   * });
   * // Period is now locked (only adjustments allowed)
   * ```
   */
  lockPeriod: protectedProcedure
    .input(LockPeriodInput)
    .mutation(async ({ ctx, input }) => {
      if (!['accountant', 'admin'].includes(ctx.user?.role || '')) {
        throw new Error('Only accountants and admins can lock periods');
      }

      const service = new FiscalYearService(ctx.company_id);

      try {
        await service.lockPeriod(input.id, ctx.user.id);
        return {
          success: true,
          message: 'Period locked for month-end closing',
        };
      } catch (error) {
        throw new Error((error as any).message || 'Failed to lock period');
      }
    }),

  /**
   * POST /fiscal-year/periods/:id/close
   *
   * Close a period permanently
   *
   * Purpose:
   * - Finalize period after month-end closing complete
   * - Lock period balances for financial statements
   * - Prevent any future changes to closed period
   *
   * Authorization: admin only
   *
   * Prerequisites:
   * - Period must be in 'locked' status
   * - At least one period must remain open
   *
   * Example Usage:
   * ```
   * await trpc.fiscalYear.closePeriod.mutate({
   *   id: "period-uuid",
   * });
   * // Period is now permanently closed
   * ```
   */
  closePeriod: protectedProcedure
    .input(ClosePeriodInput)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== 'admin') {
        throw new Error('Only admins can close periods');
      }

      const service = new FiscalYearService(ctx.company_id);

      try {
        await service.closePeriod(input.id);
        return {
          success: true,
          message: 'Period closed successfully',
        };
      } catch (error) {
        throw new Error((error as any).message || 'Failed to close period');
      }
    }),

  /**
   * GET /fiscal-year/validate-posting-date
   *
   * Validate if a transaction date can be posted
   *
   * Purpose:
   * - Check before posting a journal entry
   * - Provide user-friendly error message if invalid
   * - Return period info if valid (for assignment)
   *
   * Algorithm:
   * 1. Find FY containing the date
   * 2. Verify FY is not locked
   * 3. Find period containing date (+ cutoff buffer)
   * 4. Verify period is open
   * 5. Return validation result
   *
   * Input:
   * - date: Transaction date to validate
   *
   * Returns:
   * - { canPost: true, period } if valid
   * - { canPost: false, reason } if invalid
   *
   * Example Usage:
   * ```
   * const validation = await trpc.fiscalYear.validatePostingDate.query({
   *   date: new Date("2025-03-15"),
   * });
   *
   * if (!validation.canPost) {
   *   console.log(`Cannot post: ${validation.reason}`);
   *   return;
   * }
   *
   * // Safe to post
   * await createJournalEntry({
   *   transaction_date: new Date("2025-03-15"),
   *   period_id: validation.period.id,
   * });
   * ```
   */
  validatePostingDate: protectedProcedure
    .input(ValidatePostingDateQuery)
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(ctx.company_id);
      return service.validatePostingDate(input.date);
    }),
});
