import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  BaseEntity as TypeOrmBaseEntity,
} from 'typeorm';

/**
 * Base entity for all ERP tables.
 * Provides common fields: id, timestamps, company_id, audit trail
 */
export abstract class BaseEntity extends TypeOrmBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  company_id!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;

  @Column('uuid', { nullable: true })
  created_by_user_id?: string;

  @Column('uuid', { nullable: true })
  updated_by_user_id?: string;

  @Column({ type: 'jsonb', nullable: true })
  audit_metadata?: Record<string, unknown>;

  @Column('boolean', { default: false })
  is_deleted!: boolean;

  @Column('timestamp with time zone', { nullable: true })
  deleted_at?: Date;

  @Column('uuid', { nullable: true })
  deleted_by_user_id?: string;
}
