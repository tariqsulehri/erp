import {
  Entity, Column, PrimaryGeneratedColumn, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Supplier — Accounts Payable sub-ledger master.
 *
 * Each supplier corresponds to one or more entries in the AP control account
 * (normally an account in the 0201010001–0201999999 range). The sum of all supplier open balances must
 * always reconcile to the AP control account in the General Ledger.
 *
 * COA linkage:
 *   ap_account_id      → linked supplier account, normally in 0201010001–0201999999
 *   advance_account_id → 2300  Supplier Advances / Prepayments
 *
 * Bank details are stored here for use when generating payment vouchers.
 */
@Entity('suppliers')
@Index(['company_id', 'code'], { unique: true })
export class Supplier {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index()
  @Column('uuid') company_id!: string;

  /* ── Identity ─────────────────────────────────────────────── */
  @Column('varchar', { length: 20  }) code!:       string;  // SUP-0001
  @Column('varchar', { length: 200 }) name!:       string;
  @Column('varchar', { length: 200, nullable: true }) trade_name?: string;

  @Column('varchar', { length: 20, default: 'company' })
  supplier_type!: string;                 // individual | company | government

  @Column('varchar', { length: 30, default: 'Supplier' })
  party_type!: 'Customer' | 'Supplier' | 'Customer And Supplier';

  @Column('varchar', { length: 20, default: 'Supplier' })
  main_role!: 'Customer' | 'Supplier';

  @Column('varchar', { length: 50, nullable: true })
  tax_registration_no?: string;           // VAT / GST / TRN

  /* ── Contact ──────────────────────────────────────────────── */
  @Column('varchar', { length: 200, nullable: true }) email?:   string;
  @Column('varchar', { length: 30,  nullable: true }) phone?:   string;
  @Column('varchar', { length: 30,  nullable: true }) mobile?:  string;
  @Column('text',    { nullable: true }) address?: string;     // remittance address
  @Column('varchar', { length: 100, nullable: true }) city?:        string;
  @Column('varchar', { length: 100, nullable: true }) country?:     string;
  @Column('varchar', { length: 20,  nullable: true }) postal_code?: string;

  /* ── Financial terms ──────────────────────────────────────── */
  @Column('smallint',              { default: 30  }) payment_terms_days!: number;
  @Column('char',    { length: 3, default: 'PKR' }) currency_code!: string;

  /* ── COA linkage ──────────────────────────────────────────── */
  @Column('uuid', { nullable: true }) ap_account_id?:      string; // Linked supplier account
  @Column('uuid', { nullable: true }) advance_account_id?: string; // 2300 Advances

  /* ── Bank details (used on payment vouchers) ──────────────── */
  @Column('varchar', { length: 100, nullable: true }) bank_name?:       string;
  @Column('varchar', { length: 50,  nullable: true }) bank_account_no?: string;
  @Column('varchar', { length: 20,  nullable: true }) bank_swift_code?: string;
  @Column('varchar', { length: 34,  nullable: true }) bank_iban?:       string;

  /* ── Meta ─────────────────────────────────────────────────── */
  @Column('boolean', { default: true  }) is_active!: boolean;
  @Column('text',    { nullable: true }) notes?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamp with time zone' }) updated_at!: Date;
}
