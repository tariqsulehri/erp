import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * ============================================================================
 * Migration: Create Fiscal Year Tables
 * ============================================================================
 *
 * Purpose:
 * 1. Create fiscal_years table for storing fiscal year configurations
 * 2. Create fiscal_periods table for storing period data (months)
 * 3. Create relationships and indexes for efficient querying
 * 4. Enable multi-year support for companies
 *
 * Tables Created:
 * - fiscal_years: Company fiscal year definitions
 * - fiscal_periods: Individual periods within fiscal years
 *
 * Key Features:
 * - Company scoping (every row has company_id)
 * - Date range validation (start_date < end_date)
 * - Period locking for month-end closing
 * - Audit trail (created_at, updated_at, locked_at, deleted)
 * - Transaction counters (for quick reporting)
 * - Balance tracking (total debits/credits for validation)
 *
 * Indexes:
 * - (company_id, fiscal_year): Fast lookup by year identifier
 * - (company_id, is_active): Find active year quickly
 * - (fiscal_year_id, period_number): Find specific period
 * - (fiscal_year_id, is_open): Find open periods for posting
 * - (start_date, end_date): Date range queries
 *
 * ============================================================================
 */
export class CreateFiscalYearTables1000000000001 implements MigrationInterface {
  /**
   * Execute migration (run on `npm run db:migrate`)
   *
   * Executed in order:
   * 1. Create fiscal_years table
   * 2. Create fiscal_periods table with FK to fiscal_years
   * 3. Create all indexes for performance
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * Create fiscal_years table
     *
     * Stores fiscal year configurations for the company.
     *
     * Key Fields:
     * - fiscal_year (VARCHAR): Human-readable identifier ("2025", "2025-2026")
     * - year_basis (VARCHAR): Calendar structure ('calendar', 'july', 'april')
     * - start_date, end_date (DATE): Year boundaries
     * - status (VARCHAR): 'open' | 'closing' | 'closed' | 'archived'
     * - is_active (BOOLEAN): Only one per company should be true
     * - is_locked (BOOLEAN): Prevents new transactions
     * - posting_cutoff_days (INT): Grace period for late entries
     * - transaction_count (INT): Cached count of transactions
     * - total_debits, total_credits (DECIMAL): For validation
     *
     * Audit Fields:
     * - created_at, updated_at: Timestamps
     * - created_by_user_id, updated_by_user_id: User IDs
     * - is_deleted, deleted_at, deleted_by_user_id: Soft delete
     */
    await queryRunner.createTable(
      new Table({
        name: 'fiscal_years',
        columns: [
          // Primary Key
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },

          // Company Scoping
          {
            name: 'company_id',
            type: 'uuid',
            isNullable: false,
          },

          // Fiscal Year Identity
          {
            name: 'fiscal_year',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'Human-readable identifier (e.g., "2025", "2025-2026")',
          },

          {
            name: 'year_basis',
            type: 'varchar',
            length: '20',
            default: "'calendar'",
            comment: 'Calendar structure: calendar, july, april',
          },

          // Date Boundaries
          {
            name: 'start_date',
            type: 'date',
            isNullable: false,
            comment: 'First day of fiscal year (inclusive)',
          },

          {
            name: 'end_date',
            type: 'date',
            isNullable: false,
            comment: 'Last day of fiscal year (inclusive)',
          },

          // Period Configuration
          {
            name: 'number_of_periods',
            type: 'int',
            default: 12,
            comment: 'Usually 12 for monthly, can be 13, 52, etc.',
          },

          {
            name: 'period_type',
            type: 'varchar',
            length: '20',
            default: "'monthly'",
            comment: 'monthly, quarterly, weekly, etc.',
          },

          // Posting Configuration
          {
            name: 'posting_cutoff_days',
            type: 'int',
            default: 0,
            comment: 'Days after period end to allow posting',
          },

          // Status & Lifecycle
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'open'",
            comment: 'open | closing | closed | archived',
          },

          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            comment: 'Only one per company should be true',
          },

          {
            name: 'is_locked',
            type: 'boolean',
            default: false,
            comment: 'Prevents new transactions when true',
          },

          {
            name: 'locked_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'When fiscal year was locked',
          },

          {
            name: 'locked_by_user_id',
            type: 'uuid',
            isNullable: true,
            comment: 'User who locked the fiscal year',
          },

          {
            name: 'closing_started_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'When closing process started',
          },

          {
            name: 'closing_completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'When closing was completed',
          },

          // Transaction Counters (cached)
          {
            name: 'transaction_count',
            type: 'int',
            default: 0,
            comment: 'Cached count of transactions in year',
          },

          {
            name: 'total_debits',
            type: 'decimal',
            precision: 18,
            scale: 2,
            default: 0,
            comment: 'Sum of all debits (for validation)',
          },

          {
            name: 'total_credits',
            type: 'decimal',
            precision: 18,
            scale: 2,
            default: 0,
            comment: 'Sum of all credits (must equal debits)',
          },

          // Notes & Metadata
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },

          // Audit Trail
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },

          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },

          {
            name: 'created_by_user_id',
            type: 'uuid',
            isNullable: true,
          },

          {
            name: 'updated_by_user_id',
            type: 'uuid',
            isNullable: true,
          },

          // Soft Delete
          {
            name: 'audit_metadata',
            type: 'jsonb',
            isNullable: true,
          },

          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },

          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },

          {
            name: 'deleted_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    /**
     * Create fiscal_periods table
     *
     * Stores individual periods (months) within fiscal years.
     *
     * Key Fields:
     * - fiscal_year_id (FK): Parent fiscal year
     * - period_number (INT): Sequence 1, 2, ..., 12
     * - period_name (VARCHAR): "January 2025", "Feb", "Period 1"
     * - start_date, end_date (DATE): Period boundaries
     * - status (VARCHAR): 'open' | 'locked' | 'closed'
     * - is_open (BOOLEAN): Can transactions be posted?
     * - is_locked (BOOLEAN): Month-end closing flag
     * - posting_cutoff_days (INT): Inherited or overridden per period
     *
     * Audit Fields:
     * - created_at, updated_at: Timestamps
     * - locked_at, locked_by_user_id: Closing audit trail
     */
    await queryRunner.createTable(
      new Table({
        name: 'fiscal_periods',
        columns: [
          // Primary Key
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },

          // Company Scoping
          {
            name: 'company_id',
            type: 'uuid',
            isNullable: false,
          },

          // Foreign Key to Fiscal Year
          {
            name: 'fiscal_year_id',
            type: 'uuid',
            isNullable: false,
            comment: 'Parent fiscal year',
          },

          // Period Identity
          {
            name: 'period_number',
            type: 'int',
            isNullable: false,
            comment: 'Sequence 1-12 (or more for non-monthly)',
          },

          {
            name: 'period_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment: 'Display name: "January 2025", "Feb", "Period 1"',
          },

          // Date Boundaries
          {
            name: 'start_date',
            type: 'date',
            isNullable: false,
            comment: 'First day of period (inclusive)',
          },

          {
            name: 'end_date',
            type: 'date',
            isNullable: false,
            comment: 'Last day of period (inclusive)',
          },

          // Status & Lifecycle
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'open'",
            comment: 'open | locked | closed',
          },

          {
            name: 'is_open',
            type: 'boolean',
            default: true,
            comment: 'Can transactions be posted?',
          },

          {
            name: 'is_locked',
            type: 'boolean',
            default: false,
            comment: 'Month-end closing flag',
          },

          {
            name: 'locked_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'When period was locked',
          },

          {
            name: 'locked_by_user_id',
            type: 'uuid',
            isNullable: true,
            comment: 'User who locked the period',
          },

          // Posting Configuration
          {
            name: 'posting_cutoff_days',
            type: 'int',
            isNullable: false,
            comment: 'Days after period end to allow posting',
          },

          // Transaction Counters (cached)
          {
            name: 'transaction_count',
            type: 'int',
            default: 0,
            comment: 'Cached count of transactions in period',
          },

          {
            name: 'total_debits',
            type: 'decimal',
            precision: 18,
            scale: 2,
            default: 0,
            comment: 'Sum of debits in this period',
          },

          {
            name: 'total_credits',
            type: 'decimal',
            precision: 18,
            scale: 2,
            default: 0,
            comment: 'Sum of credits in this period',
          },

          // Notes
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },

          // Audit Trail
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },

          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },

          {
            name: 'created_by_user_id',
            type: 'uuid',
            isNullable: true,
          },

          {
            name: 'updated_by_user_id',
            type: 'uuid',
            isNullable: true,
          },

          // Soft Delete
          {
            name: 'audit_metadata',
            type: 'jsonb',
            isNullable: true,
          },

          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },

          {
            name: 'deleted_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },

          {
            name: 'deleted_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    /**
     * Create indexes for performance
     *
     * Key queries that need fast lookup:
     * 1. Find fiscal year by company_id + fiscal_year string
     * 2. Find active fiscal year (company_id + is_active)
     * 3. Find period in fiscal year (fiscal_year_id + period_number)
     * 4. Find open periods (fiscal_year_id + is_open)
     * 5. Range queries (start_date, end_date)
     */

    // fiscal_years indexes
    await queryRunner.createIndex(
      'fiscal_years',
      new TableIndex({
        name: 'idx_fiscal_years_company_year',
        columnNames: ['company_id', 'fiscal_year'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'fiscal_years',
      new TableIndex({
        name: 'idx_fiscal_years_company_active',
        columnNames: ['company_id', 'is_active', 'is_deleted'],
      }),
    );

    await queryRunner.createIndex(
      'fiscal_years',
      new TableIndex({
        name: 'idx_fiscal_years_dates',
        columnNames: ['start_date', 'end_date'],
      }),
    );

    // fiscal_periods indexes
    await queryRunner.createIndex(
      'fiscal_periods',
      new TableIndex({
        name: 'idx_fiscal_periods_fy_number',
        columnNames: ['fiscal_year_id', 'period_number'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'fiscal_periods',
      new TableIndex({
        name: 'idx_fiscal_periods_fy_open',
        columnNames: ['fiscal_year_id', 'is_open', 'is_deleted'],
      }),
    );

    await queryRunner.createIndex(
      'fiscal_periods',
      new TableIndex({
        name: 'idx_fiscal_periods_dates',
        columnNames: ['start_date', 'end_date'],
      }),
    );

    /**
     * Create foreign key constraint
     *
     * Purpose:
     * - Ensure fiscal_period.fiscal_year_id points to valid FiscalYear
     * - Cascade delete periods when fiscal year is deleted
     * - Maintain referential integrity
     */
    await queryRunner.createForeignKey(
      'fiscal_periods',
      new TableForeignKey({
        columnNames: ['fiscal_year_id'],
        referencedTableName: 'fiscal_years',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // Delete periods when FY is deleted
        onUpdate: 'CASCADE',
      }),
    );
  }

  /**
   * Rollback migration (run on `npm run db:migrate:revert`)
   *
   * Executed in reverse order:
   * 1. Drop foreign key constraint
   * 2. Drop all indexes
   * 3. Drop fiscal_periods table
   * 4. Drop fiscal_years table
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key first (must be before dropping table)
    await queryRunner.dropForeignKey('fiscal_periods', 'fiscal_years');

    // Drop indexes
    await queryRunner.dropIndex('fiscal_periods', 'idx_fiscal_periods_dates');
    await queryRunner.dropIndex('fiscal_periods', 'idx_fiscal_periods_fy_open');
    await queryRunner.dropIndex('fiscal_periods', 'idx_fiscal_periods_fy_number');

    await queryRunner.dropIndex('fiscal_years', 'idx_fiscal_years_dates');
    await queryRunner.dropIndex('fiscal_years', 'idx_fiscal_years_company_active');
    await queryRunner.dropIndex('fiscal_years', 'idx_fiscal_years_company_year');

    // Drop tables
    await queryRunner.dropTable('fiscal_periods');
    await queryRunner.dropTable('fiscal_years');
  }
}
