import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
  OneToMany, ManyToOne, JoinColumn, Index,
} from 'typeorm';

export type VoucherType   = 'BRV' | 'BPV' | 'CRV' | 'CPV' | 'JV' | 'CV' | 'DN' | 'CN';
export type VoucherStatus = 'Draft' | 'Posted' | 'Voided';

/**
 * Voucher types:
 *   BRV — Bank Receipt Voucher   (money received into bank account)
 *   BPV — Bank Payment Voucher   (money paid out of bank account)
 *   CRV — Cash Receipt Voucher   (cash received in hand)
 *   CPV — Cash Payment Voucher   (cash paid out of hand)
 *   JV  — Journal Voucher        (general / adjusting entries)
 *   CV  — Contra Voucher         (cash ↔ bank transfer)
 *   DN  — Debit Note             (debit memo to party)
 *   CN  — Credit Note            (credit memo to party)
 */
@Entity('vouchers')
@Index(['company_id', 'voucher_number'], { unique: true })
@Index(['company_id', 'voucher_date'])
@Index(['company_id', 'status'])
export class Voucher {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  company_id!: string;

  /** Auto-generated: PV-2026-0001 */
  @Column('varchar', { length: 30 })
  voucher_number!: string;

  @Column('varchar', { length: 5 })
  voucher_type!: VoucherType;

  @Column('date')
  voucher_date!: Date;

  /** Optional external reference (cheque no., invoice no.) */
  @Column('varchar', { length: 100, nullable: true })
  reference?: string;

  /** Description / narration for the whole voucher */
  @Column('text', { nullable: true })
  narration?: string;

  @Column('varchar', { length: 20, default: 'Draft' })
  status!: VoucherStatus;

  /** Sum of debit lines — must equal total_credit when Posted */
  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  total_debit!: string;

  /** Sum of credit lines */
  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  total_credit!: string;

  @Column('uuid', { nullable: true })
  created_by?: string;

  @Column('uuid', { nullable: true })
  posted_by?: string;

  @Column('timestamp with time zone', { nullable: true })
  posted_at?: Date;

  @Column('uuid', { nullable: true })
  voided_by?: string;

  @Column('timestamp with time zone', { nullable: true })
  voided_at?: Date;

  @Column('text', { nullable: true })
  void_reason?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;

  @OneToMany(() => VoucherLine, (line) => line.voucher, { cascade: true, eager: false })
  lines?: VoucherLine[];
}

@Entity('voucher_lines')
@Index(['voucher_id'])
@Index(['account_id'])
export class VoucherLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  voucher_id!: string;

  @Column('uuid')
  company_id!: string;

  @Column('uuid')
  account_id!: string;

  /** Account code (denormalised for display without extra join) */
  @Column('varchar', { length: 10 })
  account_code!: string;

  /** Account name (denormalised) */
  @Column('varchar', { length: 200 })
  account_name!: string;

  /** Debit amount — 0 when this line is a credit */
  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  dr_amount!: string;

  /** Credit amount — 0 when this line is a debit */
  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  cr_amount!: string;

  /** Line-level narration */
  @Column('text', { nullable: true })
  narration?: string;

  /** Sequence for display order */
  @Column('int', { default: 1 })
  line_no!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @ManyToOne(() => Voucher, (v) => v.lines)
  @JoinColumn({ name: 'voucher_id' })
  voucher?: Voucher;
}
