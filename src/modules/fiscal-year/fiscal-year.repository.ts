import { Repository, FindOptionsWhere } from 'typeorm';
import { FiscalYear, FiscalPeriod } from './fiscal-year.entity';
import { BaseRepository } from '@/db/base.repository';

/**
 * ============================================================================
 * FiscalYearRepository
 * ============================================================================
 *
 * Data access layer for FiscalYear entity.
 *
 * Responsibilities:
 * 1. Query fiscal years by status, activity, and date ranges
 * 2. Validate fiscal year boundaries and period integrity
 * 3. Enforce business rules at the database level
 * 4. Provide efficient lookups for posting validation
 * 5. Support period lifecycle management (open, lock, close)
 *
 * All methods automatically scope queries to current company_id via BaseRepository.
 *
 * ============================================================================
 */
export class FiscalYearRepository extends BaseRepository<FiscalYear> {
  constructor(repository: Repository<FiscalYear>) {
    super(repository);
  }

  /**
   * Find the currently active fiscal year for the company
   *
   * Purpose:
   * - Returns the fiscal year that users are currently working in
   * - Only ONE fiscal year per company should be active (is_active = true)
   * - Used when creating transactions without explicit year selection
   *
   * @returns FiscalYear | null — The active fiscal year, or null if none
   *
   * @example
   * const activeFY = await repo.findActiveFiscalYear();
   * if (!activeFY) {
   *   throw new Error('No active fiscal year. Create one first.');
   * }
   */
  async findActiveFiscalYear(): Promise<FiscalYear | null> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    return this.findOne({
      where: {
        company_id: this.companyId as any,
        is_active: true as any,
        is_deleted: false as any,
      } as FindOptionsWhere<FiscalYear>,
      relations: { periods: true },
    });
  }

  /**
   * Find fiscal year by fiscal_year string identifier
   *
   * Purpose:
   * - Lookup by human-readable year (e.g., "2025", "2025-2026")
   * - Used when user selects a specific year from dropdown
   *
   * @param fiscalYear — The fiscal year identifier (e.g., "2025")
   * @returns FiscalYear | null
   *
   * @example
   * const fy = await repo.findByFiscalYear("2025");
   */
  async findByFiscalYear(fiscalYear: string): Promise<FiscalYear | null> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    return this.findOne({
      where: {
        company_id: this.companyId as any,
        fiscal_year: fiscalYear as any,
        is_deleted: false as any,
      } as FindOptionsWhere<FiscalYear>,
      relations: { periods: true },
    });
  }

  /**
   * Find fiscal year that contains a given date
   *
   * Purpose:
   * - Determine which fiscal year a transaction date belongs to
   * - When posting a transaction, find the fiscal year automatically
   * - Essential for multi-year posting validation
   *
   * Algorithm:
   * 1. Find all active fiscal years where date is between start_date and end_date
   * 2. Return the matching fiscal year (should be only one)
   * 3. Return null if date doesn't fall in any fiscal year
   *
   * @param date — The date to find the fiscal year for
   * @returns FiscalYear | null — Matching fiscal year, or null
   *
   * @example
   * const fy = await repo.findFiscalYearForDate(new Date('2025-03-15'));
   * // Returns FY 2025 if it contains March 15, 2025
   */
  async findFiscalYearForDate(date: Date): Promise<FiscalYear | null> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const query = this.createQueryBuilder('fy')
      .where('fy.company_id = :companyId', { companyId: this.companyId })
      .andWhere('fy.is_deleted = false')
      .andWhere('fy.start_date <= :date', { date })
      .andWhere('fy.end_date >= :date', { date })
      .leftJoinAndSelect('fy.periods', 'periods');

    return query.getOne();
  }

  /**
   * Get all fiscal years for the company (not deleted)
   *
   * Purpose:
   * - Display list of available fiscal years in UI dropdown
   * - Show history of fiscal years for navigation
   *
   * @returns FiscalYear[] — All fiscal years, ordered by start_date descending (newest first)
   *
   * @example
   * const allYears = await repo.findAllFiscalYears();
   * // [FY 2026, FY 2025, FY 2024, ...]
   */
  async findAllFiscalYears(): Promise<FiscalYear[]> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    return this.find({
      where: {
        company_id: this.companyId as any,
        is_deleted: false as any,
      } as FindOptionsWhere<FiscalYear>,
      relations: { periods: true },
      order: { start_date: 'DESC' }, // Newest first
    });
  }

  /**
   * Check if a given date is within posting range for any open period
   *
   * Purpose:
   * - Validation before posting a transaction
   * - Ensures date falls within open period + posting cutoff days
   * - Prevents posting to closed periods
   *
   * Algorithm:
   * 1. Find fiscal year containing the date
   * 2. Find period containing the date (or up to posting_cutoff_days after)
   * 3. Check if period is open (is_open = true)
   * 4. Return validation result with period info
   *
   * @param date — Transaction date to validate
   * @returns Object — { canPost: boolean, period?: FiscalPeriod, reason?: string }
   *
   * @example
   * const validation = await repo.validatePostingDate(new Date('2025-03-15'));
   * if (!validation.canPost) {
   *   console.log(`Cannot post: ${validation.reason}`);
   * }
   */
  async validatePostingDate(date: Date): Promise<{
    canPost: boolean;
    period?: FiscalPeriod;
    reason?: string;
  }> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    // Find fiscal year containing this date
    const fy = await this.findFiscalYearForDate(date);
    if (!fy) {
      return {
        canPost: false,
        reason: 'Date does not fall within any active fiscal year',
      };
    }

    // If fiscal year is locked, prevent posting
    if (fy.is_locked) {
      return {
        canPost: false,
        reason: 'Fiscal year is locked. No new transactions allowed.',
      };
    }

    // Find period containing this date (including cutoff buffer) — PostgreSQL syntax
    const periodQuery = this.manager
      .createQueryBuilder(FiscalPeriod, 'period')
      .where('period.fiscal_year_id = :fyId', { fyId: fy.id })
      .andWhere('period.start_date <= :date', { date })
      .andWhere(
        "(period.end_date + (period.posting_cutoff_days * INTERVAL '1 day')) >= :date",
        { date },
      );

    const period = await periodQuery.getOne();
    if (!period) {
      return {
        canPost: false,
        reason: 'No open period found for this date (beyond posting cutoff)',
      };
    }

    // Check if period is open
    if (!period.is_open) {
      return {
        canPost: false,
        reason: `Period "${period.period_name}" is closed. Cannot post transactions.`,
      };
    }

    return { canPost: true, period };
  }

  /**
   * Lock a fiscal year for closing
   *
   * Purpose:
   * - Prevent all transactions when fiscal year is being closed
   * - Used in month-end/year-end closing procedures
   * - Creates immutable record of closing timestamp
   *
   * Changes:
   * - Sets is_locked = true
   * - Records locked_at timestamp
   * - Records locked_by_user_id for audit trail
   * - Changes status to 'closing' or 'closed'
   *
   * @param id — Fiscal year ID to lock
   * @param userId — User ID performing the lock (for audit trail)
   *
   * @example
   * await repo.lockFiscalYear(fyId, currentUserId);
   */
  async lockFiscalYear(id: string, userId: string): Promise<void> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    await this.update(
      {
        id: id as any,
        company_id: this.companyId as any,
      } as FindOptionsWhere<FiscalYear>,
      {
        is_locked: true as any,
        locked_at: new Date() as any,
        locked_by_user_id: userId as any,
        status: 'closed' as any,
      } as any,
    );
  }

  /**
   * Get fiscal year with all periods loaded
   *
   * Purpose:
   * - Efficiently load a fiscal year and its period structure in one query
   * - Used for period management UI and posting validation
   *
   * @param id — Fiscal year ID
   * @returns FiscalYear with periods[] loaded, or null if not found
   *
   * @example
   * const fy = await repo.findWithPeriods(fyId);
   * fy.periods.forEach(p => console.log(p.period_name));
   */
  async findWithPeriods(id: string): Promise<FiscalYear | null> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    return this.findOne({
      where: {
        id: id as any,
        company_id: this.companyId as any,
        is_deleted: false as any,
      } as FindOptionsWhere<FiscalYear>,
      relations: { periods: true },
    });
  }

  /**
   * Count how many fiscal years exist in the company
   *
   * Purpose:
   * - Validate that at least one fiscal year exists
   * - Check if company needs initial setup
   * - Enforce one-active-year constraint
   *
   * @returns number — Count of non-deleted fiscal years
   *
   * @example
   * const count = await repo.countFiscalYears();
   * if (count === 0) {
   *   throw new Error('No fiscal years. Create one first.');
   * }
   */
  async countFiscalYears(): Promise<number> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    return this.count({
      where: {
        company_id: this.companyId as any,
        is_deleted: false as any,
      } as FindOptionsWhere<FiscalYear>,
    });
  }
}

/**
 * ============================================================================
 * FiscalPeriodRepository
 * ============================================================================
 *
 * Data access layer for FiscalPeriod entity.
 *
 * Responsibilities:
 * 1. Query periods within a fiscal year
 * 2. Find period for a given date
 * 3. Validate period posting rules
 * 4. Lock/unlock periods for closing
 * 5. Track period-level totals (debits, credits, transaction count)
 *
 * ============================================================================
 */
export class FiscalPeriodRepository {
  constructor(private manager: any) {}

  /**
   * Find period by fiscal year and period number
   *
   * Purpose:
   * - Get specific period (e.g., January, February)
   * - Used in period management and closing procedures
   *
   * @param fiscalYearId — Parent fiscal year ID
   * @param periodNumber — Period sequence (1-12 usually)
   * @returns FiscalPeriod | null
   *
   * @example
   * const jan = await repo.findByPeriodNumber(fyId, 1);
   */
  async findByPeriodNumber(fiscalYearId: string, periodNumber: number): Promise<FiscalPeriod | null> {
    return this.manager.findOne(FiscalPeriod, {
      where: {
        fiscal_year_id: fiscalYearId,
        period_number: periodNumber,
      },
    });
  }

  /**
   * Find period that contains a given date
   *
   * Purpose:
   * - Determine which period a transaction date belongs to
   * - Essential for automatic period assignment during posting
   *
   * Algorithm:
   * 1. Find period where start_date <= date <= end_date
   * 2. Consider posting_cutoff_days for late entries
   * 3. Return matching period
   *
   * @param fiscalYearId — Parent fiscal year
   * @param date — Date to locate
   * @returns FiscalPeriod | null
   *
   * @example
   * const period = await repo.findPeriodForDate(fyId, new Date('2025-03-15'));
   * // Returns March period
   */
  async findPeriodForDate(fiscalYearId: string, date: Date): Promise<FiscalPeriod | null> {
    return this.manager
      .createQueryBuilder(FiscalPeriod, 'period')
      .where('period.fiscal_year_id = :fyId', { fyId: fiscalYearId })
      .andWhere('period.start_date <= :date', { date })
      .andWhere("(period.end_date + (period.posting_cutoff_days * INTERVAL '1 day')) >= :date", {
        date,
      })
      .getOne();
  }

  /**
   * Lock a period for closing
   *
   * Purpose:
   * - Prevent regular transactions during month-end closing
   * - Allow only adjusting entries (accruals, reversals)
   *
   * Changes:
   * - Sets is_open = false
   * - Sets is_locked = true
   * - Records locked_at and locked_by_user_id
   *
   * @param periodId — Period to lock
   * @param userId — User performing the lock
   *
   * @example
   * await repo.lockPeriod(periodId, userId);
   */
  async lockPeriod(periodId: string, userId: string): Promise<void> {
    await this.manager.update(
      FiscalPeriod,
      { id: periodId },
      {
        is_open: false,
        is_locked: true,
        locked_at: new Date(),
        locked_by_user_id: userId,
      },
    );
  }

  /**
   * Close a period permanently
   *
   * Purpose:
   * - Finalize a period after all transactions are posted
   * - Prevent any changes (even adjusting entries) after closure
   * - Used after month-end closing process completes
   *
   * Changes:
   * - Sets status = 'closed'
   * - Sets is_open = false (already was if previously locked)
   *
   * @param periodId — Period to close
   *
   * @example
   * await repo.closePeriod(periodId);
   */
  async closePeriod(periodId: string): Promise<void> {
    await this.manager.update(FiscalPeriod, { id: periodId }, { status: 'closed' as any, is_open: false });
  }

  /**
   * Get all periods for a fiscal year in order
   *
   * Purpose:
   * - Display period list in UI (for selection, closing, etc.)
   * - Show period calendar/timeline
   *
   * @param fiscalYearId — Fiscal year to get periods for
   * @returns FiscalPeriod[] — All periods ordered by period_number (ascending)
   *
   * @example
   * const periods = await repo.findAllPeriods(fyId);
   * periods.forEach(p => console.log(p.period_name)); // Jan, Feb, Mar, ...
   */
  async findAllPeriods(fiscalYearId: string): Promise<FiscalPeriod[]> {
    return this.manager.find(FiscalPeriod, {
      where: { fiscal_year_id: fiscalYearId },
      order: { period_number: 'ASC' },
    });
  }

  /**
   * Count open periods in fiscal year
   *
   * Purpose:
   * - Ensure at least one period remains open
   * - Prevent closing all periods (would lock company)
   * - Validate period state consistency
   *
   * @param fiscalYearId — Fiscal year to check
   * @returns number — Count of open periods
   *
   * @example
   * const openCount = await repo.countOpenPeriods(fyId);
   * if (openCount === 0) {
   *   throw new Error('Cannot close all periods');
   * }
   */
  async countOpenPeriods(fiscalYearId: string): Promise<number> {
    return this.manager.count(FiscalPeriod, {
      where: {
        fiscal_year_id: fiscalYearId,
        is_open: true,
      },
    });
  }
}
