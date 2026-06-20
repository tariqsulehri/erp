import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('general_settings')
@Index(['company_id'], { unique: true })
export class GeneralSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  company_id!: string;

  @Column('char', { length: 2, default: 'PK' })
  default_country_code!: string;

  @Column('varchar', { length: 80, default: 'Asia/Karachi' })
  time_zone!: string;

  @Column('varchar', { length: 20, default: 'en-PK' })
  locale!: string;

  @Column('varchar', { length: 20, default: 'dd/MM/yyyy' })
  date_format!: string;

  @Column('varchar', { length: 20, default: '12-hour' })
  time_format!: '12-hour' | '24-hour';

  @Column('char', { length: 3, default: 'PKR' })
  currency_code!: string;

  @Column('varchar', { length: 10, default: 'Rs' })
  currency_symbol!: string;

  @Column('varchar', { length: 10, default: 'prefix' })
  currency_position!: 'prefix' | 'suffix';

  @Column('int', { default: 2 })
  decimal_places!: number;

  @Column('varchar', { length: 5, default: ',' })
  thousand_separator!: string;

  @Column('varchar', { length: 5, default: '.' })
  decimal_separator!: string;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
