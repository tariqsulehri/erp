import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * AccountAuditLog — immutable record of every change made to an Account.
 *
 * Written by AccountService on create / update / activate / deactivate.
 * Never updated — only inserted and read.
 *
 * Stored per-company so it participates in the same multi-tenancy pattern
 * as the Account entity (though filtered by account_id, not company_id range).
 */
@Entity('account_audit_logs')
@Index(['account_id', 'created_at'])
@Index(['company_id', 'created_at'])
export class AccountAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The account this log entry belongs to */
  @Column('uuid')
  account_id!: string;

  /** Denormalised for company-scoped queries */
  @Column('uuid')
  company_id!: string;

  /** Email or display name of the user who made the change */
  @Column('varchar', { length: 255, nullable: true })
  changed_by?: string;

  /**
   * High-level action label:
   *   'created' | 'updated' | 'activated' | 'deactivated' | 'cloned'
   */
  @Column('varchar', { length: 50 })
  action!: string;

  /**
   * Field-level diff.
   * Each key is a field name; value is { from, to }.
   * Null for 'created' actions (no previous state).
   */
  @Column('jsonb', { nullable: true })
  changes?: Record<string, { from: unknown; to: unknown }>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
