import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

abstract class TransactionMasterBase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  company_id!: string;

  @Column('varchar', { length: 30 })
  code!: string;

  @Column('varchar', { length: 150 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}

@Entity('cost_centers')
@Index(['company_id', 'code'], { unique: true })
@Index(['company_id', 'is_active'])
export class CostCenter extends TransactionMasterBase {}

@Entity('projects')
@Index(['company_id', 'code'], { unique: true })
@Index(['company_id', 'is_active'])
export class Project extends TransactionMasterBase {
  @Column('date', { nullable: true })
  start_date?: Date;

  @Column('date', { nullable: true })
  end_date?: Date;
}

@Entity('departments')
@Index(['company_id', 'code'], { unique: true })
@Index(['company_id', 'is_active'])
export class Department extends TransactionMasterBase {}

@Entity('document_attachments')
@Index(['company_id', 'document_type', 'document_id'])
export class DocumentAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  company_id!: string;

  @Column('varchar', { length: 50 })
  document_type!: string;

  @Column('uuid')
  document_id!: string;

  @Column('varchar', { length: 255 })
  file_name!: string;

  @Column('varchar', { length: 500 })
  file_url!: string;

  @Column('varchar', { length: 100, nullable: true })
  file_type?: string;

  @Column('bigint', { nullable: true })
  file_size?: string;

  @Column('uuid', { nullable: true })
  uploaded_by_id?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  uploaded_at!: Date;
}

@Entity('document_approvals')
@Index(['company_id', 'document_type', 'document_id'])
export class DocumentApproval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  company_id!: string;

  @Column('varchar', { length: 50 })
  document_type!: string;

  @Column('uuid')
  document_id!: string;

  @Column('varchar', { length: 30 })
  approval_status!: string;

  @Column('uuid', { nullable: true })
  approved_by_id?: string;

  @Column('timestamp with time zone', { nullable: true })
  approved_at?: Date;

  @Column('text', { nullable: true })
  remarks?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
