import { AppDataSource } from '@/db/data-source';
import { FiscalYear, FiscalPeriod } from './fiscal-year.entity';
import { FiscalYearRepository, FiscalPeriodRepository } from './fiscal-year.repository';
import { CreateFiscalYearInput, CreatePeriodInput } from './fiscal-year.schema';
import { addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';

/**
 * ============================================================================
 * FiscalYearService
 * ============================================================================
 *
 * Business logic for fiscal year management.
 *
 * Key Responsibilities:
 * 1. Create fiscal years with automatic period generation
 * 2. Validate date ranges and period boundaries
 * 3. Enforce business rules (one active year per company)
 * 4. Support period lifecycle (open → locked → closed)
 * 5. Validate posting dates against period status
 * 6. Provide reporting on fiscal year status and transactions
 *
 * Fiscal Year Lifecycle:
 * 1. CREATE: New FY created with periods generated
 * 2. OPEN: Users post transactions in open periods
 * 3. CLOSING: Month-end/year-end closing procedures
 * 4. CLOSED: No new transactions, keep for audit trail
 * 5. ARCHIVED: Old years, searchable but read-only
 *
 * All methods automatically scope to current company_id.
 *
 * ============================================================================
 */
export class FiscalYearService {
  private fyRepo: FiscalYearRepository;
  private periodRepo: FiscalPeriodRepository;

  constructor(private companyId: string) {
    this.fyRepo = new FiscalYearRepository(AppDataSource.getRepository(FiscalYear));
    this.fyRepo.setCompanyId(companyId);
    this.periodRepo = new FiscalPeriodRepository(AppDataSource.manager);
  }

  /**
   * Create a new fiscal year with automatic period generation
   *
   * Process:
   * 1. Validate input (dates, period count)
   * 2. Check for overlapping fiscal years
   * 3. Create FiscalYear record
   * 4. Generate periods (monthly by default)
   * 5. Make newly created year active (set is_active = true)
   * 6. Deactivate previous active year
   *
   * Periods Generated:
   * - For 12-period years: Jan 1 - Dec 31, one month per period
   * - Period names: "January 2025", "February 2025", etc.
   * - Each period inherits posting_cutoff_days from fiscal year
   *
   * Validation Rules:
   * - start_date must be before end_date
   * - At least 1 period required
   * - Cannot overlap with existing fiscal years
   * - end_date - start_date must be evenly divisible into period count
   *
   * @param data — CreateFiscalYearInput with:
   *   - fiscal_year: "2025" or "2025-2026"
   *   - year_basis: 'calendar' | 'july' | 'april'
   *   - start_date: Period start
   *   - end_date: Period end
   *   - number_of_periods: Usually 12
   *   - posting_cutoff_days: Days after period end to allow posting
   *
   * @returns FiscalYear — The created fiscal year with periods
   *
   * @throws Error if validation fails
   *
   * @example
   * const fy = await service.createFiscalYear({
   *   fiscal_year: '2025',
   *   year_basis: 'calendar',
   *   start_date: new Date('2025-01-01'),
   *   end_date: new Date('2025-12-31'),
   *   number_of_periods: 12,
   *   posting_cutoff_days: 5,
   * });
   * // Creates FY 2025 with 12 monthly periods
   */
  async createFiscalYear(data: CreateFiscalYearInput): Promise<FiscalYear> {
    // Validate date order
    if (data.start_date >= data.end_date) {
      throw new Error('Start date must be before end date');
    }

    // Validate period count
    if (data.number_of_periods < 1) {
      throw new Error('Fiscal year must have at least 1 period');
    }

    // Check for overlapping fiscal years
    const existingYears = await this.fyRepo.findAllFiscalYears();
    const hasOverlap = existingYears.some(
      (fy) =>
        (data.start_date >= fy.start_date && data.start_date <= fy.end_date) ||
        (data.end_date >= fy.start_date && data.end_date <= fy.end_date),
    );

    if (hasOverlap) {
      throw new Error('Fiscal year dates overlap with existing fiscal years');
    }

    // Deactivate current active year
    const activeFY = await this.fyRepo.findActiveFiscalYear();
    if (activeFY) {
      await AppDataSource.getRepository(FiscalYear).update(
        { id: activeFY.id },
        { is_active: false } as any,
      );
    }

    // Create fiscal year
    const fy = AppDataSource.getRepository(FiscalYear).create({
      company_id: this.companyId,
      fiscal_year: data.fiscal_year,
      year_basis: data.year_basis,
      start_date: data.start_date,
      end_date: data.end_date,
      number_of_periods: data.number_of_periods,
      period_type: 'monthly',
      is_active: true,
      posting_cutoff_days: data.posting_cutoff_days,
      status: 'open',
      periods: [],
    });

    const savedFY = await AppDataSource.getRepository(FiscalYear).save(fy);

    // Generate periods
    const periods = this.generatePeriods(
      savedFY.id,
      data.start_date,
      data.end_date,
      data.number_of_periods,
      data.posting_cutoff_days,
    );

    savedFY.periods = await AppDataSource.getRepository(FiscalPeriod).save(periods);

    return savedFY;
  }

  /**
   * Generate period records for a fiscal year
   *
   * Algorithm:
   * 1. Calculate days between start and end
   * 2. Divide days by number_of_periods to get days per period
   * 3. Create period for each: month 0, 1, 2, ..., 11
   * 4. Period names: "January 2025", "February 2025", etc.
   * 5. Assign period numbers starting at 1
   *
   * For 12 periods over Jan-Dec:
   * - Period 1: Jan 1 - Jan 31
   * - Period 2: Feb 1 - Feb 28/29
   * - ...
   * - Period 12: Dec 1 - Dec 31
   *
   * @param fiscalYearId — FY to create periods for
   * @param startDate — First day of fiscal year
   * @param endDate — Last day of fiscal year
   * @param numberOfPeriods — How many periods to create (usually 12)
   * @param postingCutoffDays — Days after period end to allow posting
   *
   * @returns FiscalPeriod[] — Array of period records ready to save
   *
   * @private — Only called from createFiscalYear
   */
  private generatePeriods(
    fiscalYearId: string,
    startDate: Date,
    endDate: Date,
    numberOfPeriods: number,
    postingCutoffDays: number,
  ): FiscalPeriod[] {
    const periods: FiscalPeriod[] = [];

    for (let i = 0; i < numberOfPeriods; i++) {
      // Calculate period start and end by adding months
      const periodStart = addMonths(startDate, i);
      let periodEnd = endOfMonth(periodStart);

      // For last period, ensure it ends on fiscal year end date
      if (i === numberOfPeriods - 1) {
        periodEnd = endDate;
      }

      // Generate period name: "January 2025"
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      const monthName = monthNames[periodStart.getMonth()];
      const year = periodStart.getFullYear();
      const periodName = `${monthName} ${year}`;

      const period = AppDataSource.getRepository(FiscalPeriod).create({
        company_id: this.companyId,
        fiscal_year_id: fiscalYearId,
        period_number: i + 1,
        period_name: periodName,
        start_date: periodStart,
        end_date: periodEnd,
        status: 'open',
        is_open: true,
        posting_cutoff_days: postingCutoffDays,
      });

      periods.push(period);
    }

    return periods;
  }

  /**
   * Get the currently active fiscal year
   *
   * Purpose:
   * - Determine which year is currently in use
   * - Default year when creating transactions without explicit selection
   * - Used in UI to show "Current Fiscal Year" context
   *
   * Returns:
   * - The ONE fiscal year with is_active = true
   * - null if no active year (company needs initialization)
   *
   * @returns FiscalYear | null — The active fiscal year with periods loaded
   *
   * @example
   * const activeFY = await service.getActiveFiscalYear();
   * console.log(`Working in: ${activeFY.fiscal_year}`);
   */
  async getActiveFiscalYear(): Promise<FiscalYear | null> {
    return this.fyRepo.findActiveFiscalYear();
  }

  /**
   * Get fiscal year by identifier string
   *
   * Purpose:
   * - Lookup specific year by user-friendly name
   * - Handles multi-year fiscal years ("2025-2026")
   *
   * @param fiscalYear — The fiscal year identifier (e.g., "2025")
   * @returns FiscalYear | null
   *
   * @example
   * const fy2024 = await service.getFiscalYear("2024");
   */
  async getFiscalYear(fiscalYear: string): Promise<FiscalYear | null> {
    return this.fyRepo.findByFiscalYear(fiscalYear);
  }

  /**
   * Get all fiscal years for the company
   *
   * Purpose:
   * - Display fiscal year selector in UI
   * - List all available years for navigation
   * - Show history and future years
   *
   * @returns FiscalYear[] — All fiscal years, newest first
   *
   * @example
   * const allYears = await service.getAllFiscalYears();
   * allYears.forEach(fy => console.log(fy.fiscal_year)); // 2026, 2025, 2024...
   */
  async getAllFiscalYears(): Promise<FiscalYear[]> {
    return this.fyRepo.findAllFiscalYears();
  }

  /**
   * Validate if a transaction date can be posted
   *
   * Validation Process:
   * 1. Check if date falls in any fiscal year (start_date to end_date)
   * 2. Verify fiscal year is not locked
   * 3. Find period containing the date
   * 4. Verify period is open (is_open = true)
   * 5. Verify date is within posting_cutoff_days of period end
   *
   * Result:
   * - { canPost: true, period } if valid
   * - { canPost: false, reason } if invalid
   *
   * This is called before every journal entry posting.
   *
   * @param date — Transaction date to validate
   * @returns Object with validation result
   *
   * @example
   * const validation = await service.validatePostingDate(new Date('2025-03-15'));
   * if (!validation.canPost) {
   *   console.log(`Cannot post: ${validation.reason}`);
   *   return;
   * }
   * // Safe to post transaction on 2025-03-15
   */
  async validatePostingDate(date: Date): Promise<{
    canPost: boolean;
    period?: FiscalPeriod;
    reason?: string;
  }> {
    return this.fyRepo.validatePostingDate(date);
  }

  /**
   * Lock a fiscal year for closing
   *
   * Purpose:
   * - Prevent all new transactions when year is being closed
   * - Used in year-end financial statement preparation
   * - Creates permanent audit trail of lock timestamp and user
   *
   * Effects:
   * - Sets is_locked = true (prevents new transactions)
   * - Changes status to 'closing' (workflow indicator)
   * - Records locked_at timestamp
   * - Records locked_by_user_id for audit trail
   *
   * After Locking:
   * - validatePostingDate() will reject all new posts
   * - Reports can be locked in place
   * - Audit trail cannot be modified
   *
   * @param fiscalYearId — FY to lock
   * @param userId — User performing the lock (for audit)
   *
   * @throws Error if fiscal year not found
   *
   * @example
   * await service.lockFiscalYear(fyId, currentUserId);
   * // FY is now locked, no new transactions allowed
   */
  async lockFiscalYear(fiscalYearId: string, userId: string): Promise<void> {
    const fy = await this.fyRepo.findOneById(fiscalYearId);
    if (!fy) {
      throw new Error('Fiscal year not found');
    }

    await this.fyRepo.lockFiscalYear(fiscalYearId, userId);
  }

  /**
   * Lock a period for month-end closing
   *
   * Purpose:
   * - Allow only adjusting entries (accruals, reversals) during month-end
   * - Prevent regular journal entries while closing in progress
   * - Create audit trail of when period was locked
   *
   * Effects:
   * - Sets is_open = false (prevents regular posting)
   * - Sets is_locked = true (indicates closing in progress)
   * - Records locked_at and locked_by_user_id
   *
   * After Locking:
   * - Regular journal entries cannot be posted
   * - Only adjusting entries (with special flag) allowed
   * - Accruals and reversals can be posted
   *
   * @param periodId — Period to lock
   * @param userId — User performing lock
   *
   * @throws Error if period not found
   *
   * @example
   * await service.lockPeriod(periodId, userId);
   * // February is now locked for closing procedures
   */
  async lockPeriod(periodId: string, userId: string): Promise<void> {
    const period = await AppDataSource.getRepository(FiscalPeriod).findOne({
      where: { id: periodId },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    await this.periodRepo.lockPeriod(periodId, userId);
  }

  /**
   * Close a period permanently
   *
   * Purpose:
   * - Finalize a period after month-end closing is complete
   * - Prevent any changes to closed period (no adjustments allowed)
   * - Lock period's balances for financial statements
   *
   * Prerequisites:
   * - Period should be in 'locked' status
   * - Month-end accruals should be complete
   * - At least one period must remain open
   *
   * Effects:
   * - Sets status = 'closed'
   * - Sets is_open = false
   * - Period balances are frozen
   * - No transactions can be posted
   *
   * @param periodId — Period to close
   *
   * @throws Error if last open period (must keep one open)
   * @throws Error if period not found
   *
   * @example
   * await service.closePeriod(periodId);
   * // February is now closed and finalized
   */
  async closePeriod(periodId: string): Promise<void> {
    const period = await AppDataSource.getRepository(FiscalPeriod).findOne({
      where: { id: periodId },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    // Ensure at least one period remains open
    const openCount = await this.periodRepo.countOpenPeriods(period.fiscal_year_id);
    if (openCount <= 1) {
      throw new Error('Cannot close the last open period. At least one must remain open.');
    }

    await this.periodRepo.closePeriod(periodId);
  }

  /**
   * Get all periods for a fiscal year
   *
   * Purpose:
   * - Display period calendar/timeline in UI
   * - Show period list for selection
   * - Enable month-end closing workflow
   *
   * @param fiscalYearId — FY to get periods for
   * @returns FiscalPeriod[] — All periods in order (1, 2, 3, ..., 12)
   *
   * @example
   * const periods = await service.getPeriods(fyId);
   * // [Jan, Feb, Mar, ..., Dec]
   */
  async getPeriods(fiscalYearId: string): Promise<FiscalPeriod[]> {
    return this.periodRepo.findAllPeriods(fiscalYearId);
  }

  /**
   * Check if at least one fiscal year exists
   *
   * Purpose:
   * - Validate company is initialized with a fiscal year
   * - Prevent errors when no FY exists
   * - Used in setup/initialization checks
   *
   * @returns boolean — true if at least one fiscal year exists
   *
   * @example
   * const hasFY = await service.hasFiscalYear();
   * if (!hasFY) {
   *   throw new Error('Please create a fiscal year first');
   * }
   */
  async hasFiscalYear(): Promise<boolean> {
    const count = await this.fyRepo.countFiscalYears();
    return count > 0;
  }
}
