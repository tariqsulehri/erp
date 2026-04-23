import {
  Entity, Column, PrimaryGeneratedColumn, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type UomType = 'Quantity' | 'Weight' | 'Volume' | 'Length' | 'Area' | 'Time' | 'Other';

@Entity('units_of_measure')
@Index(['company_id', 'abbreviation'], { unique: true })
export class UnitOfMeasure {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid')                 company_id!: string;

  @Column('varchar', { length: 80 })  name!: string;         // e.g. Kilogram
  @Column('varchar', { length: 20 })  abbreviation!: string; // e.g. kg
  @Column('varchar', { length: 20 })  uom_type!: UomType;

  @Column('boolean', { default: true }) is_active!: boolean;
  @Column('boolean', { default: false }) is_default!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamp with time zone' }) updated_at!: Date;
}
