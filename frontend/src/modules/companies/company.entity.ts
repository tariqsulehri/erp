import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

/**
 * Company Group - represents the holding/parent entity
 */
@Entity('company_groups')
export class CompanyGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 100 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('varchar', { length: 20, nullable: true })
  registration_number?: string;

  @Column('varchar', { length: 100, nullable: true })
  parent_company?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;

  @OneToMany(() => Company, (company) => company.group)
  companies?: Company[];
}

/**
 * Company - represents an individual legal entity
 * Every other table carries company_id as a foreign key
 */
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  group_id!: string;

  @ManyToOne(() => CompanyGroup, (group) => group.companies, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'group_id' })
  group!: CompanyGroup;

  @Column('varchar', { length: 100 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('varchar', { length: 20, nullable: true })
  registration_number?: string;

  @Column('varchar', { length: 50, nullable: true })
  tax_id?: string;

  @Column('varchar', { length: 50, nullable: true })
  currency_code?: string;

  @Column('varchar', { length: 10, default: 'Rs' })
  currency_symbol!: string;

  @Column('int', { default: 2 })
  decimal_places!: number;

  @Column('varchar', { length: 5, default: ',' })
  thousand_separator!: string;

  @Column('varchar', { length: 5, default: '.' })
  decimal_separator!: string;

  @Column('varchar', { length: 20, default: 'dd/MM/yyyy' })
  date_format!: string;

  @Column('varchar', { length: 20, default: '12-hour' })
  time_format!: '12-hour' | '24-hour';

  @Column('varchar', { length: 80, default: 'Asia/Karachi' })
  time_zone!: string;

  @Column('varchar', { length: 20, default: 'en-PK' })
  locale!: string;

  @Column('char', { length: 2, default: 'PK' })
  default_country_code!: string;

  @Column('varchar', { length: 100, nullable: true })
  address?: string;

  @Column('varchar', { length: 100, nullable: true })
  city?: string;

  @Column('varchar', { length: 100, nullable: true })
  country?: string;

  @Column('varchar', { length: 20, nullable: true })
  phone?: string;

  @Column('varchar', { length: 100, nullable: true })
  email?: string;

  @Column('varchar', { length: 50, default: 'calendar' })
  fiscal_year_basis!: 'calendar' | 'july' | 'april';

  @Column('int', { default: 12 })
  number_of_periods!: number;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
