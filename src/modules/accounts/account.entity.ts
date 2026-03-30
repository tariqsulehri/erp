import { Entity, Column, Index, Check } from 'typeorm';
import { BaseEntity } from '@/db/base.entity';

/**
 * Account Entity — Core to Chart of Accounts
 *
 * All codes are exactly 4 digits. Hierarchy is determined by numeric value:
 *   X000  →  Level 1  Category    (divisible by 1000)  e.g. 1000 Assets
 *   XX00  →  Level 2  Group       (divisible by 100)   e.g. 1100 Current Assets
 *   XXX0  →  Level 3  Sub-Group   (divisible by 10)    e.g. 1110 Cash & Equivalents
 *   XXXX  →  Level 4  Posting Acct (not div. by 10)   e.g. 1111 Cash in Hand
 *
 * Parent resolution:
 *   1111 → parent 1110 (floor to nearest 10)
 *   1110 → parent 1100 (floor to nearest 100)
 *   1100 → parent 1000 (floor to nearest 1000)
 *   1000 → no parent
 */
@Entity('accounts')
@Index(['company_id', 'code'], { unique: true })
@Index(['company_id', 'is_posting', 'is_deleted'])
@Index(['company_id', 'is_active', 'is_deleted'])
@Check('"code" ~ \'^[0-9]{4}$\'') // Exactly 4 digits
export class Account extends BaseEntity {
  @Column('varchar', { length: 4 })
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
