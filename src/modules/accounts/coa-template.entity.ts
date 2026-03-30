import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * COA Template Entity
 * Predefined Chart of Accounts templates that are instantiated
 * when a new company is created.
 *
 * Templates include:
 * - Standard Trading
 * - Manufacturing
 * - Services
 */

export interface TemplateAccount {
  code: string;
  name: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  normal_balance: 'Debit' | 'Credit';
  is_posting: boolean;
  is_system?: boolean;
  description?: string;
  sort_order?: number;
}

@Entity('coa_templates')
@Index(['template_code'], { unique: true })
export class COATemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 50 })
  template_code!: string; // e.g., 'TRADING', 'MANUFACTURING', 'SERVICES'

  @Column('varchar', { length: 100 })
  template_name!: string; // e.g., 'Standard Trading COA'

  @Column('text', { nullable: true })
  description?: string;

  @Column('jsonb')
  accounts!: TemplateAccount[]; // Array of accounts to be created

  @Column('int')
  account_count!: number;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}

/**
 * Account Categories Constants
 * Used for seeding and validation
 */
export const ACCOUNT_CATEGORIES = {
  ASSETS: {
    code: '1',
    name: 'Assets',
    normal_balance: 'Debit',
  },
  LIABILITIES: {
    code: '2',
    name: 'Liabilities',
    normal_balance: 'Credit',
  },
  EQUITY: {
    code: '3',
    name: 'Equity',
    normal_balance: 'Credit',
  },
  REVENUE: {
    code: '4',
    name: 'Revenue',
    normal_balance: 'Credit',
  },
  EXPENSES: {
    code: '5',
    name: 'Expenses',
    normal_balance: 'Debit',
  },
};
