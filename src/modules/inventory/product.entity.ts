import {
  Entity, Column, PrimaryGeneratedColumn, Index,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { UnitOfMeasure }   from './uom.entity';

export type ProductType   = 'Finished' | 'RawMaterial' | 'SemiFinished' | 'Service' | 'Consumable';
export type ProductStatus = 'Active' | 'Inactive' | 'Discontinued';
export type TaxCategory   = 'Standard' | 'Zero-Rated' | 'Exempt';

/**
 * Product — core inventory item.
 *
 * Design decisions:
 *  • SKU is unique per company (generated or entered manually).
 *  • Prices stored at 4 decimal places for sub-cent accuracy.
 *  • Stock figures (on_hand, reserved, min_level) stored here for fast reads.
 *    A separate StockMovement table (future) will be the authoritative ledger.
 *  • Soft-delete via status = 'Discontinued' — data is never hard-deleted.
 */
@Entity('products')
@Index(['company_id', 'sku'],     { unique: true })
@Index(['company_id', 'barcode'], { unique: true, where: 'barcode IS NOT NULL' })
@Index(['company_id', 'status'])
@Index(['company_id', 'category_id'])
export class Product {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid')                 company_id!: string;

  /* ── Identification ─────────────────────────────────── */
  @Column('varchar', { length: 60 })   sku!: string;
  @Column('varchar', { length: 100, nullable: true }) barcode?: string;
  @Column('varchar', { length: 250 })  name!: string;
  @Column('text',    { nullable: true }) description?: string;
  @Column('varchar', { length: 100, nullable: true }) brand?: string;
  @Column('varchar', { length: 100, nullable: true }) model?: string;

  /* ── Classification ─────────────────────────────────── */
  @Column('uuid', { nullable: true }) category_id?: string;
  @Column('uuid', { nullable: true }) uom_id?: string;

  @ManyToOne(() => ProductCategory, { nullable: true, eager: false })
  @JoinColumn({ name: 'category_id' })
  category?: ProductCategory;

  @ManyToOne(() => UnitOfMeasure, { nullable: true, eager: false })
  @JoinColumn({ name: 'uom_id' })
  uom?: UnitOfMeasure;

  @Column('varchar', { length: 30 })  product_type!: ProductType;
  @Column('varchar', { length: 20, default: 'Active' }) status!: ProductStatus;

  @Column('boolean', { default: true })  is_sellable!: boolean;
  @Column('boolean', { default: true })  is_purchasable!: boolean;

  /* ── Pricing ────────────────────────────────────────── */
  /** Purchase / landed cost */
  @Column('decimal', { precision: 18, scale: 4, default: 0 }) cost_price!: string;
  /** Standard selling price before discounts */
  @Column('decimal', { precision: 18, scale: 4, default: 0 }) sale_price!: string;
  /** Minimum selling price (floor price) */
  @Column('decimal', { precision: 18, scale: 4, nullable: true }) min_sale_price?: string;

  @Column('varchar', { length: 20, default: 'Standard' }) tax_category!: TaxCategory;
  /** Tax rate as percentage, e.g. 17 for 17% GST */
  @Column('decimal', { precision: 6, scale: 2, default: 0 }) tax_rate!: string;

  /* ── Stock Control ──────────────────────────────────── */
  /** Current on-hand quantity (updated by stock movements) */
  @Column('decimal', { precision: 18, scale: 4, default: 0 }) qty_on_hand!: string;
  /** Reserved quantity (sales orders not yet shipped) */
  @Column('decimal', { precision: 18, scale: 4, default: 0 }) qty_reserved!: string;
  /** Reorder trigger level */
  @Column('decimal', { precision: 18, scale: 4, nullable: true }) min_stock_level?: string;
  /** Maximum stock to hold */
  @Column('decimal', { precision: 18, scale: 4, nullable: true }) max_stock_level?: string;
  /** Default quantity to order when reordering */
  @Column('decimal', { precision: 18, scale: 4, nullable: true }) reorder_qty?: string;

  @Column('boolean', { default: true }) track_inventory!: boolean;

  /* ── Physical attributes ────────────────────────────── */
  @Column('decimal', { precision: 10, scale: 3, nullable: true }) weight?: string;
  @Column('varchar', { length: 10, nullable: true })               weight_unit?: string; // kg, g, lb
  @Column('decimal', { precision: 10, scale: 3, nullable: true }) length_cm?: string;
  @Column('decimal', { precision: 10, scale: 3, nullable: true }) width_cm?: string;
  @Column('decimal', { precision: 10, scale: 3, nullable: true }) height_cm?: string;

  /* ── Meta ───────────────────────────────────────────── */
  @Column('text',    { nullable: true }) image_url?: string;
  @Column('text',    { nullable: true }) notes?: string;
  @Column('varchar', { length: 20, nullable: true }) tags?: string; // comma-separated
  @Column('int',     { default: 0 }) sort_order!: number;

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamp with time zone' }) updated_at!: Date;
}
