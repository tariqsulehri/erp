import { Entity, Column, Index, Check } from 'typeorm';
import { BaseEntity } from '@/db/base.entity';

/**
 * Account Entity — 6-digit Chart of Accounts
 *
 * Main COA codes are exactly 6 digits.  Hierarchy is determined by numeric value:
 *   X00000  Level 1  Category    divisible by 100000   e.g. 100000  Assets
 *   XX0000  Level 2  Group       divisible by  10000   e.g. 110000  Current Assets
 *   XXX000  Level 3  Sub-Group   divisible by   1000   e.g. 113000  Trade Receivables
 *   XXXX00  Level 4  Sub-Detail  divisible by    100   e.g. 113100  AR Control
 *   XXXXX0  Level 5  Segment     divisible by     10   e.g. 113110  AR – Domestic
 *   XXXXXX  Level 6  Posting     NOT divisible by 10   e.g. 113111  AR – Misc Posting
 *
 * Sub-ledger accounts use 7-digit codes (never COA hierarchy pivots):
 *   1300001–1399999  →  AR debtors  (customers) — 99,999 per company
 *   2100001–2199999  →  AP creditors (suppliers) — 99,999 per company
 *
 * Parent resolution (6-digit main COA):
 *   113111 → parent 113110 (floor to nearest 10)
 *   113110 → parent 113100 (floor to nearest 100)
 *   113100 → parent 113000 (floor to nearest 1000)
 *   113000 → parent 110000 (floor to nearest 10000)
 *   110000 → parent 100000 (floor to nearest 100000)
 *   100000 → no parent (root)
 */
@Entity('accounts')
@Index(['company_id', 'code'], { unique: true })
@Index(['company_id', 'is_posting', 'is_deleted'])
@Index(['company_id', 'is_active', 'is_deleted'])
@Check('"code" ~ \'^[0-9]{6,10}$\'') // 6-digit main COA or 7-10 digit sub-ledger
export class Account extends BaseEntity {
  @Column('varchar', { length: 10 })
  code!: string;

  @Column('varchar', { length: 100 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('varchar', { length: 50 })
  account_type!: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

  @Column('varchar', { length: 10 })
  normal_balance!: 'Debit' | 'Credit';

  @Column('boolean', { default: false })
  is_posting!: boolean;

  @Column('boolean', { default: false })
  is_system!: boolean;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column('int', { default: 0, nullable: true })
  sort_order?: number;

  @Column('uuid', { nullable: true })
  category_id?: string;

  /**
   * Opening balance amount (positive = debit-side, negative = credit-side).
   * Set once during company setup / migration from a previous system.
   * Used as the starting point for balance calculations until GL is built.
   */
  @Column('decimal', { precision: 15, scale: 2, nullable: true })
  opening_balance?: number;

  /** Date as of which the opening balance applies (typically start of fiscal year) */
  @Column('date', { nullable: true })
  opening_balance_date?: Date;

  @Column('jsonb', { nullable: true })
  tax_codes?: Record<string, unknown>;

  @Column('jsonb', { nullable: true })
  attributes?: Record<string, unknown>;
}

/**
 * Account Category Entity — For grouping and reporting
 * Maps 1-digit category codes to human-readable categories
 */
@Entity('account_categories')
@Index(['category_code'], { unique: true })
export class AccountCategory {
  @Column('varchar', { length: 1, primary: true })
  category_code!: string;

  @Column('varchar', { length: 50 })
  name!: string;

  @Column('varchar', { length: 10 })
  normal_balance!: 'Debit' | 'Credit';

  @Column('text', { nullable: true })
  description?: string;

  @Column('int', { default: 0 })
  sort_order!: number;
}
