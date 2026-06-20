import { Entity, Column, Index, Check } from 'typeorm';
import { BaseEntity } from '@/db/base.entity';

/**
 * Account Entity — 10-digit Chart of Accounts
 *
 * Codes are exactly 10 digits and use the structure MM GG SS PPPP:
 *   0100000000  Level 1  Main Category      e.g. Assets
 *   0101000000  Level 2  Group              e.g. Current Assets
 *   0101100000  Level 3  Sub-Group          e.g. Cash And Bank
 *   0101100001  Level 4  Posting Account    e.g. Cash In Hand
 *
 * Linked party account ranges:
 *   0103010001–0103999999  →  Customers
 *   0201010001–0201999999  →  Suppliers
 *
 * Parent resolution:
 *   0101100001 → parent 0101100000
 *   0101100000 → parent 0101000000
 *   0101000000 → parent 0100000000
 *   0100000000 → no parent
 */
@Entity('accounts')
@Index(['company_id', 'code'], { unique: true })
@Index(['company_id', 'is_posting', 'is_deleted'])
@Index(['company_id', 'is_active', 'is_deleted'])
@Check('"code" ~ \'^[0-9]{10}$\'')
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
