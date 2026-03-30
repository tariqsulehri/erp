import { z } from 'zod';

/**
 * ============================================================================
 * Fiscal Year Zod Schemas
 * ============================================================================
 *
 * Validation schemas for tRPC procedures and form submission.
 *
 * Used for:
 * 1. tRPC input validation (automatic on all procedures)
 * 2. Frontend form validation
 * 3. API request/response type safety
 * 4. Database constraint validation (double-check)
 *
 * All schemas use Zod for composable, type-safe validation.
 * Inference with z.infer<typeof> creates TypeScript types automatically.
 *
 * ============================================================================
 */

/**
 * Create FiscalYear Input Schema
 *
 * Input validation for creating a new fiscal year.
 *
 * Rules:
 * - fiscal_year: Required, human-readable identifier
 *   Examples: "2025", "2025-2026", "FY2025"
 * - year_basis: Required, determines calendar structure
 *   Options: 'calendar' (Jan-Dec), 'july' (Jul-Jun), 'april' (Apr-Mar)
 * - start_date and end_date: Required, in valid order
 * - number_of_periods: Required, at least 1, usually 12
 * - posting_cutoff_days: Optional, defaults to 0
 *   Allows posting this many days after period end
 *
 * Example Usage:
 * ```
 * const input = CreateFiscalYearInput.parse({
 *   fiscal_year: "2025",
 *   year_basis: "calendar",
 *   start_date: new Date("2025-01-01"),
 *   end_date: new Date("2025-12-31"),
 *   number_of_periods: 12,
 *   posting_cutoff_days: 5,
 * });
 * ```
 */
export const CreateFiscalYearInput = z.object({
  /**
   * Fiscal year identifier (human-readable)
   * Examples: "2025", "2025-2026"
   * Used in UI dropdowns and reports
   */
  fiscal_year: z
    .string()
    .min(1)
    .max(50)
    .describe('Fiscal year identifier (e.g., "2025", "2025-2026")'),

  /**
   * Fiscal year basis (calendar structure)
   * - calendar: January 1 - December 31
   * - july: July 1 - June 30 (Australia, Japan)
   * - april: April 1 - March 31 (India, UK)
   */
  year_basis: z
    .enum(['calendar', 'july', 'april'])
    .default('calendar')
    .describe('Fiscal year basis (calendar, july, or april)'),

  /**
   * First day of the fiscal year (inclusive)
   * Example: 2025-01-01
   * Must be before end_date
   */
  start_date: z
    .date()
    .describe('Fiscal year start date'),

  /**
   * Last day of the fiscal year (inclusive)
   * Example: 2025-12-31
   * Must be after start_date
   */
  end_date: z
    .date()
    .describe('Fiscal year end date'),

  /**
   * Number of periods to create
   * Standard: 12 (monthly)
   * Can be: 13 (lunar), 52/53 (weekly), 4 (quarterly)
   * Minimum: 1
   */
  number_of_periods: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(12)
    .describe('Number of periods (usually 12 for monthly)'),

  /**
   * Days after period end that allow posting
   * Example: 5 = can post for 5 days after period end
   * Used for month-end accruals, adjustments, late entries
   * Default: 0 (no grace period)
   */
  posting_cutoff_days: z
    .number()
    .int()
    .min(0)
    .max(365)
    .default(0)
    .describe('Days after period end to allow posting'),
});

// Export TypeScript type inferred from schema
export type CreateFiscalYearInput = z.infer<typeof CreateFiscalYearInput>;

/**
 * Update FiscalYear Input Schema
 *
 * Input validation for updating fiscal year details.
 *
 * Immutable Fields (cannot change):
 * - fiscal_year: Identifier stays the same
 * - start_date and end_date: Date boundaries are fixed
 *
 * Mutable Fields:
 * - posting_cutoff_days: Can adjust grace period
 * - notes: Can add/edit notes
 *
 * Rationale:
 * - Changing dates would affect period structure and existing postings
 * - Identifier is used in ledgers, changing it would be confusing
 * - Cutoff days can be adjusted for operational needs
 */
export const UpdateFiscalYearInput = z.object({
  /**
   * Days after period end to allow posting (can be adjusted)
   * Helps with month-end flexibility
   */
  posting_cutoff_days: z
    .number()
    .int()
    .min(0)
    .max(365)
    .optional()
    .describe('Update posting cutoff days'),

  /**
   * Custom notes for this fiscal year
   * For explanations, special handling, etc.
   */
  notes: z
    .string()
    .max(1000)
    .optional()
    .describe('Notes about this fiscal year'),
});

export type UpdateFiscalYearInput = z.infer<typeof UpdateFiscalYearInput>;

/**
 * Create Period Input Schema
 *
 * Input validation for manually creating/adjusting periods.
 *
 * Note: Most of the time, periods are auto-generated
 * when creating a fiscal year. This is for custom period
 * structures (13 periods, weekly periods, etc.).
 */
export const CreatePeriodInput = z.object({
  /**
   * Parent fiscal year ID (FK to FiscalYear)
   */
  fiscal_year_id: z
    .string()
    .uuid()
    .describe('Parent fiscal year ID'),

  /**
   * Period sequence number (1, 2, 3, ..., 12)
   * Unique per fiscal year
   */
  period_number: z
    .number()
    .int()
    .min(1)
    .describe('Period number (1-12 or more)'),

  /**
   * Human-readable period name
   * Examples: "January 2025", "Feb", "Period 1"
   * Displayed in UI
   */
  period_name: z
    .string()
    .min(1)
    .max(100)
    .describe('Period name for display'),

  /**
   * Period start date
   */
  start_date: z
    .date()
    .describe('Period start date'),

  /**
   * Period end date
   */
  end_date: z
    .date()
    .describe('Period end date'),

  /**
   * Days after period end to allow posting
   */
  posting_cutoff_days: z
    .number()
    .int()
    .min(0)
    .describe('Posting cutoff days for this period'),
});

export type CreatePeriodInput = z.infer<typeof CreatePeriodInput>;

/**
 * Query Fiscal Years Schema
 *
 * Input validation for listing/filtering fiscal years.
 * Supports pagination and optional filtering.
 */
export const GetFiscalYearsQuery = z.object({
  /**
   * Page number for pagination (1-based)
   */
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('Page number'),

  /**
   * Items per page (max 100)
   */
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Items per page'),

  /**
   * Filter by status: open, closing, closed, archived
   */
  status: z
    .enum(['open', 'closing', 'closed', 'archived'])
    .optional()
    .describe('Filter by status'),

  /**
   * Only show active fiscal year
   */
  is_active: z
    .boolean()
    .optional()
    .describe('Filter by active status'),
});

export type GetFiscalYearsQuery = z.infer<typeof GetFiscalYearsQuery>;

/**
 * FiscalYear Response Schema
 *
 * Output validation for API responses.
 * Ensures all required fields are present and correct types.
 */
export const FiscalYearResponse = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  fiscal_year: z.string(),
  year_basis: z.enum(['calendar', 'july', 'april']),
  start_date: z.date(),
  end_date: z.date(),
  number_of_periods: z.number().int(),
  period_type: z.string(),
  status: z.enum(['open', 'closing', 'closed', 'archived']),
  is_active: z.boolean(),
  is_locked: z.boolean(),
  posting_cutoff_days: z.number().int(),
  transaction_count: z.number().int(),
  total_debits: z.string().optional(),
  total_credits: z.string().optional(),
  notes: z.string().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type FiscalYearResponse = z.infer<typeof FiscalYearResponse>;

/**
 * FiscalPeriod Response Schema
 *
 * Output validation for period API responses.
 */
export const FiscalPeriodResponse = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  fiscal_year_id: z.string().uuid(),
  period_number: z.number().int(),
  period_name: z.string(),
  start_date: z.date(),
  end_date: z.date(),
  status: z.enum(['open', 'locked', 'closed']),
  is_open: z.boolean(),
  is_locked: z.boolean(),
  posting_cutoff_days: z.number().int(),
  transaction_count: z.number().int(),
  total_debits: z.string().optional(),
  total_credits: z.string().optional(),
  notes: z.string().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type FiscalPeriodResponse = z.infer<typeof FiscalPeriodResponse>;

/**
 * Lock FiscalYear Input Schema
 *
 * Input for locking a fiscal year (prevents new transactions).
 */
export const LockFiscalYearInput = z.object({
  /**
   * Fiscal year ID to lock
   */
  id: z
    .string()
    .uuid()
    .describe('Fiscal year ID to lock'),
});

export type LockFiscalYearInput = z.infer<typeof LockFiscalYearInput>;

/**
 * Lock Period Input Schema
 *
 * Input for locking a period (month-end closing).
 */
export const LockPeriodInput = z.object({
  /**
   * Period ID to lock
   */
  id: z
    .string()
    .uuid()
    .describe('Period ID to lock'),
});

export type LockPeriodInput = z.infer<typeof LockPeriodInput>;

/**
 * Close Period Input Schema
 *
 * Input for permanently closing a period.
 */
export const ClosePeriodInput = z.object({
  /**
   * Period ID to close
   */
  id: z
    .string()
    .uuid()
    .describe('Period ID to close'),
});

export type ClosePeriodInput = z.infer<typeof ClosePeriodInput>;

/**
 * Validate Posting Date Query Schema
 *
 * Input for validating if a date can receive transactions.
 */
export const ValidatePostingDateQuery = z.object({
  /**
   * Date to validate for posting
   */
  date: z
    .date()
    .describe('Date to validate for posting'),
});

export type ValidatePostingDateQuery = z.infer<typeof ValidatePostingDateQuery>;
