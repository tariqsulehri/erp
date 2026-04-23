import {
  Entity, Column, PrimaryGeneratedColumn, Index,
  CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';

/**
 * ProductCategory — self-referencing hierarchy with materialized-path tree.
 *
 * path  : slash-separated UUID chain from root to self
 *         e.g. "root_id"  |  "root_id/parent_id/self_id"
 * depth : 0 = root, 1 = child, 2 = grandchild, max 7
 *
 * Tree queries:
 *   descendants : WHERE path LIKE '{cat.path}/%'
 *   ancestors   : path.split('/') gives all ancestor IDs
 *   cycle check : new_parent.path must NOT contain cat.id
 */
@Entity('product_categories')
@Index(['company_id', 'code'], { unique: true })
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index()
  @Column('uuid') company_id!: string;

  @Column('varchar', { length: 20  }) code!:        string;
  @Column('varchar', { length: 150 }) name!:        string;
  @Column('text',    { nullable: true }) description?: string;

  /* ── Self-referencing hierarchy ─────────────────────────────── */
  @Index()
  @Column('uuid', { nullable: true }) parent_id?: string;

  @ManyToOne(() => ProductCategory, (c) => c.children, { nullable: true, eager: false })
  @JoinColumn({ name: 'parent_id' })
  parent?: ProductCategory;

  @OneToMany(() => ProductCategory, (c) => c.parent, { eager: false })
  children?: ProductCategory[];

  /* ── Materialized-path tree columns (maintained by service) ── */
  @Column('smallint', { default: 0 })
  depth!: number;

  /** Full ancestor path, e.g. "grandparent_id/parent_id/self_id" */
  @Index()
  @Column('varchar', { length: 4000, default: '' })
  path!: string;

  /* ── Display / ordering ──────────────────────────────────────── */
  @Column('int',     { default: 0    }) sort_order!: number;
  @Column('boolean', { default: true }) is_active!:  boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamp with time zone' }) updated_at!: Date;
}
