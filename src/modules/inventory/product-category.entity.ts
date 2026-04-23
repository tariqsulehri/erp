import {
  Entity, Column, PrimaryGeneratedColumn, Index,
  CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';

@Entity('product_categories')
@Index(['company_id', 'code'], { unique: true })
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid')                 company_id!: string;

  @Column('varchar', { length: 20 })  code!: string;       // e.g. EL, EL-MOB
  @Column('varchar', { length: 150 }) name!: string;
  @Column('text',    { nullable: true }) description?: string;

  /** Self-referencing hierarchy */
  @Column('uuid', { nullable: true }) parent_id?: string;

  @ManyToOne(() => ProductCategory, (c) => c.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: ProductCategory;

  @OneToMany(() => ProductCategory, (c) => c.parent)
  children?: ProductCategory[];

  @Column('int',     { default: 0 })     sort_order!: number;
  @Column('boolean', { default: true })  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamp with time zone' }) updated_at!: Date;
}
