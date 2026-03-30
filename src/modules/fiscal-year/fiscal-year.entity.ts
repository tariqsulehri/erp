import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '@/db/base.entity';

/**
 * ============================================================================
 * FiscalYear Entity
 * ============================================================================
 *
 * Represents a complete fiscal year (12 months) for a company.
 *
 * Fiscal Year Basis Options:
 * - "calendar": January 1 - December 31
 * - "july": July 1 - June 30 (common in Australia, Japan)
 * - "april": April 1 - March 31 (India standard, UK tax year)
 *
 * Key Responsibilities:
 * 1. Define fiscal year boundaries (start_date, end_date)
 * 2. Determine period structure (number of periods: 12, 13, 52, etc.)
 * 3. Control posting cutoff (when transactions can no longer be posted)
 * 4. Lock/unlock periods for closing (financial statements)
 * 5. Track closing status (open, in-progress, closed)
 *
 * Business Rules:
 * - Must have at least 1 period
 * - end_date must be after start_date
 * - Cannot modify start_date or end_date after periods are created
 * - Cannot delete fiscal year if transactions exist
 *
 * Audit Trail:
 * - Inherits from BaseEntity: created_at, updated_at, created_by_user_id, updated_by_user_id
 * - Tracks who created, modified, and closed the fiscal year
 *
 * ============================================================================
 */
@Entity('fiscal_years')
@Index(['company_id', 'fiscal_year'], { unique: true })
@Index(['company_id', 'is_active'])
export class FiscalYear extends BaseEntity {
  /**
   * Fiscal year identifier (e.g., 2024, 2025-2026)
   * Used to distinguish multiple fiscal years in the same company
   */
  @Column('varchar', { length: 50 })
  fiscal_year!: string;

  /**
   * Fiscal year basis that determines the calendar structure
   * - "calendar": Jan 1 - Dec 31 (most common)
   * - "july": Jul 1 - Jun 30 (Australia, Japan)
   * - "april": Apr 1 - Mar 31 (India, UK)
   */
  @Column('varchar', { length: 20, default: 'calendar' })
  year_basis!: 'calendar' | 'july' | 'april';

  /**
   * Fiscal year start date (inclusive)
   * Example: 2025-01-01 for calendar year 2025
   * Cannot be modified after periods are created
   */
  @Column('date')
  start_date!: Date;

  /**
   * Fiscal year end date (inclusive)
   * Example: 2025-12-31 for calendar year 2025
   * Cannot be modified after periods are created
   */
  @Column('date')
  end_date!: Date;

  /**
   * Number of periods in this fiscal year
   * Standard: 12 (monthly)
   * Can be: 13 (lunar calendar), 52/53 (weekly), 4 (quarterly), etc.
   */
  @Column('int', { default: 12 })
  number_of_periods!: number;

  /**
   * Period length type for UI display
   * Helps the system and users understand the period structure
   * Values: 'monthly', 'quarterly', 'weekly', 'daily', etc.
   */
  @Column('varchar', { length: 20, default: 'monthly' })
  period_type!: string;

  /**
   * Current status of the fiscal year
   * - "open": Transactions can be posted in any open period
   * - "closing": In the process of month-end/year-end closing
   * - "closed": All periods closed, no new transactions allowed
   * - "archived": Historical year, kept for audit trail only
   */
  @Column('varchar', { length: 20, default: 'open' })
  status!: 'open' | 'closing' | 'closed' | 'archived';

  /**
   * Flag indicating if this is the currently active fiscal year
   * Only ONE fiscal year per company can have is_active = true
   * Users select which year to work in via this flag
   */
  @Column('boolean', { default: true })
  is_active!: boolean;

  /**
   * Number of days after period end that transactions can still be posted
   * Example: 5 = transactions can be posted up to 5 days after period end
   * Used for accruals, reversals, and late entries
   * Enforced at posting engine level
   */
  @Column('int', { default: 0 })
  posting_cutoff_days!: number;

  /**
   * Flag indicating whether this fiscal year is locked
   * When locked:
   * - No new transactions can be posted
   * - Existing transactions cannot be edited/deleted
   * - Used for regulatory/audit compliance
   */
  @Column('boolean', { default: false })
  is_locked!: boolean;

  /**
   * Date when fiscal year was locked
   * Used for audit trail and lock enforcement
   */
  @Column('timestamp with time zone', { nullable: true })
  locked_at?: Date;

  /**
   * User ID who locked the fiscal year
   * Foreign key to user who performed the action
   */
  @Column('uuid', { nullable: true })
  locked_by_user_id?: string;

  /**
   * Date when fiscal year closing process started
   * Null if closing has not begun
   */
  @Column('timestamp with time zone', { nullable: true })
  closing_started_at?: Date;

  /**
   * Date when fiscal year closing was completed
   * Null if closing has not been completed
   */
  @Column('timestamp with time zone', { nullable: true })
  closing_completed_at?: Date;

  /**
   * Number of transaction records in this fiscal year
   * Cached for quick lookup and validation
   * Updated whenever transactions are posted/deleted
   */
  @Column('int', { default: 0 })
  transaction_count!: number;

  /**
   * Total debit amount across all transactions
   * Used for quick balance validation and reporting
   * Must equal total credits for clean closing
   */
  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  total_debits!: string;

  /**
   * Total credit amount across all transactions
   * Must equal total debits for clean closing (double-entry rule)
   */
  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  total_credits!: string;

  /**
   * Custom notes for this fiscal year
   * Used for explanations, special handling, etc.
   */
  @Column('text', { nullable: true })
  notes?: string;

  /**
   * Timestamps for audit trail
   * created_at: When fiscal year record was created
   * updated_at: When last modified (fields, not transactions)
   */
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;

  /**
   * Relationship to periods in this fiscal year
   * One fiscal year has many periods (12 by default)
   * Loaded via @OneToMany relationship
   */
  @OneToMany(() => FiscalPeriod, (period) => period.fiscal_year, { cascade: true })
  periods?: FiscalPeriod[];
}

/**
 * ============================================================================
 * FiscalPeriod Entity
 * ============================================================================
 *
 * Represents a single period (month, week, etc.) within a fiscal year.
 *
 * One Fiscal Year contains 12+ Periods (usually one per month)
 *
 * Key Responsibilities:
 * 1. Define period boundaries (start_date, end_date)
 * 2. Control posting (when transactions can be posted to this period)
 * 3. Lock periods for closing (month-end accruals, adjustments)
 * 4. Track period status (open, locked, closed)
 * 5. Store period-level balances (for reporting)
 *
 * Business Rules:
 * - Periods must be contiguous (no gaps)
 * - Cannot post to closed periods
 * - Cannot post beyond posting_cutoff_days after period end
 * - At least one period must remain open at all times
 * - Period boundaries cannot overlap
 *
 * Period Lifecycle:
 * 1. OPEN: Transactions can be posted
 * 2. LOCKED: Month-end adjustment period (optional)
 * 3. CLOSED: No more transactions allowed
 * 4. ARCHIVED: Historical, kept for audit only
 *
 * ============================================================================
 */
@Entity('fiscal_periods')
@Index(['fiscal_year_id', 'period_number'], { unique: true })
@Index(['fiscal_year_id', 'is_open'])
@Index(['fiscal_year_id', 'is_locked'])
export class FiscalPeriod extends BaseEntity {
  /**
   * Foreign key to FiscalYear
   * Relates this period to its parent fiscal year
   */
  @Column('uuid')
  fiscal_year_id!: string;

  /**
   * Many-to-one relation back to the parent FiscalYear
   */
  @ManyToOne(() => FiscalYear, (fy) => fy.periods)
  @JoinColumn({ name: 'fiscal_year_id' })
  fiscal_year?: FiscalYear;

  /**
   * Period sequence number within the fiscal year
   * Example: Period 1 = January, Period 2 = February, etc.
   * Range: 1 to number_of_periods (usually 1-12)
   * Unique per fiscal year
   */
  @Column('int')
  period_number!: number;

  /**
   * Human-readable period name for display
   * Examples: "January 2025", "Feb", "Period 1", "Week 1"
   * Used in reports, dropdowns, and UI
   */
  @Column('varchar', { length: 100 })
  period_name!: string;

  /**
   * Period start date (inclusive)
   * Example: 2025-01-01 for January
   * Cannot be modified after transactions are posted
   */
  @Column('date')
  start_date!: Date;

  /**
   * Period end date (inclusive)
   * Example: 2025-01-31 for January
   * All transactions on this date belong to this period
   */
  @Column('date')
  end_date!: Date;

  /**
   * Current status of the period
   * - "open": Transactions can be posted here
   * - "locked": Month-end adjustments only (accruals, reversals)
   * - "closed": No transactions allowed
   */
  @Column('varchar', { length: 20, default: 'open' })
  status!: 'open' | 'locked' | 'closed';

  /**
   * Flag: Can transactions be posted to this period?
   * Inverse of is_locked: is_open = NOT is_locked
   * Faster query performance than checking status enum
   */
  @Column('boolean', { default: true })
  is_open!: boolean;

  /**
   * Flag: Is this period locked for closing?
   * When true:
   * - Only adjusting entries can be posted (via special flag)
   * - Month-end accruals, reversals
   * - No regular journal entries
   */
  @Column('boolean', { default: false })
  is_locked!: boolean;

  /**
   * Date when period was locked
   * Timestamp for audit trail
   */
  @Column('timestamp with time zone', { nullable: true })
  locked_at?: Date;

  /**
   * User ID who locked this period
   * Foreign key to user who performed the action
   */
  @Column('uuid', { nullable: true })
  locked_by_user_id?: string;

  /**
   * Number of days after period end that transactions can be posted
   * Inherited from FiscalYear but can be overridden per period
   * Example: 5 = can post up to Jan 31 + 5 days = Feb 5
   */
  @Column('int')
  posting_cutoff_days!: number;

  /**
   * Period-level transaction count
   * Cached for validation: sum of all period transaction counts = fiscal year total
   */
  @Column('int', { default: 0 })
  transaction_count!: number;

  /**
   * Period-level total debits
   * Sum of all debit amounts posted in this period
   * Cached for quick reporting
   */
  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  total_debits!: string;

  /**
   * Period-level total credits
   * Sum of all credit amounts posted in this period
   * Must equal total_debits for balanced period
   */
  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  total_credits!: string;

  /**
   * Custom notes for this period
   * Used for explanations of special handling, accruals, etc.
   */
  @Column('text', { nullable: true })
  notes?: string;

  /**
   * Timestamps for audit trail
   * created_at: When period record was created (usually during year setup)
   * updated_at: When period status changed (locked, closed, etc.)
   */
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
