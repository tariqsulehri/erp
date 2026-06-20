import {
  Entity, Column, PrimaryGeneratedColumn, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Customer — Accounts Receivable sub-ledger master.
 *
 * Each customer corresponds to one or more entries in the AR control account
 * (normally an account in the 0103010001–0103999999 range). The sum of all customer open balances must
 * always reconcile to the AR control account in the General Ledger.
 *
 * COA linkage:
 *   ar_account_id      → linked customer account, normally in 0103010001–0103999999
 *   advance_account_id → 2200  Customer Advances / Deposits
 */
@Entity('customers')
@Index(['company_id', 'code'], { unique: true })
export class Customer {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index()
  @Column('uuid') company_id!: string;

  /* ── Identity ─────────────────────────────────────────────── */
  @Column('varchar', { length: 20  }) code!:       string;  // CUS-0001
  @Column('varchar', { length: 200 }) name!:       string;
  @Column('varchar', { length: 200, nullable: true }) trade_name?: string;

  @Column('varchar', { length: 20, default: 'company' })
  customer_type!: string;                 // individual | company | government

  @Column('varchar', { length: 30, default: 'Customer' })
  party_type!: 'Customer' | 'Supplier' | 'Customer And Supplier';

  @Column('varchar', { length: 20, default: 'Customer' })
  main_role!: 'Customer' | 'Supplier';

  @Column('varchar', { length: 50, nullable: true })
  tax_registration_no?: string;           // VAT / GST / TRN

  /* ── Contact ──────────────────────────────────────────────── */
  @Column('varchar', { length: 200, nullable: true }) email?:  string;
  @Column('varchar', { length: 30,  nullable: true }) phone?:  string;
  @Column('varchar', { length: 30,  nullable: true }) mobile?: string;
  @Column('text',    { nullable: true }) billing_address?:  string;
  @Column('text',    { nullable: true }) shipping_address?: string;
  @Column('varchar', { length: 100, nullable: true }) city?:        string;
  @Column('varchar', { length: 100, nullable: true }) country?:     string;
  @Column('varchar', { length: 20,  nullable: true }) postal_code?: string;

  /* ── Financial terms ──────────────────────────────────────── */
  @Column('smallint',              { default: 30  }) payment_terms_days!: number;
  @Column('numeric', { precision: 18, scale: 2, default: 0 }) credit_limit!: number;
  @Column('char',    { length: 3, default: 'PKR' }) currency_code!: string;

  /* ── COA linkage ──────────────────────────────────────────── */
  @Column('uuid', { nullable: true }) ar_account_id?:      string; // Linked customer account
  @Column('uuid', { nullable: true }) advance_account_id?: string; // 2200 Advances

  /* ── Meta ─────────────────────────────────────────────────── */
  @Column('boolean', { default: true  }) is_active!: boolean;
  @Column('text',    { nullable: true }) notes?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamp with time zone' }) updated_at!: Date;
}
