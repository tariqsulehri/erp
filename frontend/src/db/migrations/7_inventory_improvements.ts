import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 7 — Inventory Quality Improvements
 *
 * Adds:
 *  1. depth + path columns to product_categories (materialized-path tree pattern)
 *  2. DB-level CHECK constraints on product_categories (anti-cycle)
 *  3. DB-level CHECK constraints on products (qty ≥ 0, price ≥ 0, min < max stock)
 *  4. weight_unit enumeration constraint
 *  5. stock_movements ledger table (immutable audit trail for all qty changes)
 */
export class InventoryImprovements1745000000007 implements MigrationInterface {
  name = 'InventoryImprovements1745000000007';

  public async up(runner: QueryRunner): Promise<void> {

    /* ─────────────────────────────────────────────────────────────────────
       1. Materialized-path columns on product_categories
       ─────────────────────────────────────────────────────────────────── */
    await runner.query(`
      ALTER TABLE product_categories
        ADD COLUMN IF NOT EXISTS depth SMALLINT     NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS path  VARCHAR(4000) NOT NULL DEFAULT '';
    `);

    /* Populate path/depth for existing rows — root nodes first, then up to 8 levels */
    await runner.query(`
      UPDATE product_categories
         SET path = id::text, depth = 0
       WHERE parent_id IS NULL;
    `);

    for (let d = 1; d <= 8; d++) {
      await runner.query(`
        UPDATE product_categories c
           SET path  = p.path || '/' || c.id::text,
               depth = ${d}
          FROM product_categories p
         WHERE c.parent_id = p.id
           AND p.depth      = ${d - 1}
           AND c.depth      = 0
           AND c.parent_id IS NOT NULL;
      `);
    }

    /* Path index for fast descendant queries: WHERE path LIKE 'root_id%' */
    await runner.query(`
      CREATE INDEX IF NOT EXISTS idx_product_categories_path
        ON product_categories(company_id, path);
    `);

    /* ─────────────────────────────────────────────────────────────────────
       2. Anti-cycle constraint on product_categories
       ─────────────────────────────────────────────────────────────────── */
    await runner.query(`
      ALTER TABLE product_categories
        ADD CONSTRAINT chk_cat_not_self_parent
          CHECK (parent_id IS NULL OR parent_id <> id);
    `);

    /* ─────────────────────────────────────────────────────────────────────
       3. Business-rule CHECK constraints on products
       ─────────────────────────────────────────────────────────────────── */
    await runner.query(`
      ALTER TABLE products
        ADD CONSTRAINT chk_product_qty_non_negative
          CHECK (qty_on_hand >= 0 AND qty_reserved >= 0 AND qty_on_hand >= qty_reserved),

        ADD CONSTRAINT chk_product_prices_non_negative
          CHECK (cost_price >= 0 AND sale_price >= 0),

        ADD CONSTRAINT chk_product_stock_levels
          CHECK (
            min_stock_level IS NULL
            OR max_stock_level IS NULL
            OR min_stock_level < max_stock_level
          );
    `);

    /* ─────────────────────────────────────────────────────────────────────
       4. weight_unit enum guard
       ─────────────────────────────────────────────────────────────────── */
    await runner.query(`
      ALTER TABLE products
        ADD CONSTRAINT chk_product_weight_unit
          CHECK (weight_unit IS NULL OR weight_unit IN ('kg','g','lb','oz','t','mg','ton'));
    `);

    /* ─────────────────────────────────────────────────────────────────────
       5. Stock movements ledger
          Immutable. One row per quantity change. Never updated or deleted.
       ─────────────────────────────────────────────────────────────────── */
    await runner.query(`
      CREATE TABLE stock_movements (
        id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id     UUID         NOT NULL,
        product_id     UUID         NOT NULL
                         REFERENCES products(id) ON DELETE RESTRICT,
        movement_type  VARCHAR(30)  NOT NULL,
        qty_change     NUMERIC(18,4) NOT NULL,
        qty_after      NUMERIC(18,4) NOT NULL,
        unit_cost      NUMERIC(18,4),
        reference_type VARCHAR(30),           -- 'VOUCHER' | 'PO' | 'SO' | 'MANUAL'
        reference_id   UUID,
        notes          TEXT,
        created_by     UUID,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT chk_stock_movement_type CHECK (
          movement_type IN (
            'OPENING',
            'PURCHASE',       'SALE',
            'RETURN_IN',      'RETURN_OUT',
            'ADJUSTMENT_IN',  'ADJUSTMENT_OUT',
            'TRANSFER_IN',    'TRANSFER_OUT',
            'RESERVATION',    'RELEASE'
          )
        )
      );
    `);

    await runner.query(`CREATE INDEX idx_stock_mvt_company  ON stock_movements(company_id);`);
    await runner.query(`CREATE INDEX idx_stock_mvt_product  ON stock_movements(company_id, product_id);`);
    await runner.query(`CREATE INDEX idx_stock_mvt_type     ON stock_movements(company_id, movement_type);`);
    await runner.query(`CREATE INDEX idx_stock_mvt_ref      ON stock_movements(reference_type, reference_id) WHERE reference_id IS NOT NULL;`);
    await runner.query(`CREATE INDEX idx_stock_mvt_date     ON stock_movements(company_id, created_at DESC);`);

    /* Prevent accidental updates/deletes on the ledger */
    await runner.query(`
      CREATE RULE no_update_stock_movements AS ON UPDATE TO stock_movements DO INSTEAD NOTHING;
      CREATE RULE no_delete_stock_movements AS ON DELETE TO stock_movements DO INSTEAD NOTHING;
    `);
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP RULE IF EXISTS no_delete_stock_movements ON stock_movements;`);
    await runner.query(`DROP RULE IF EXISTS no_update_stock_movements ON stock_movements;`);
    await runner.query(`DROP TABLE IF EXISTS stock_movements;`);

    await runner.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_product_weight_unit;`);
    await runner.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_product_stock_levels;`);
    await runner.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_product_prices_non_negative;`);
    await runner.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_product_qty_non_negative;`);

    await runner.query(`ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS chk_cat_not_self_parent;`);
    await runner.query(`DROP INDEX  IF EXISTS idx_product_categories_path;`);
    await runner.query(`ALTER TABLE product_categories DROP COLUMN IF EXISTS path;`);
    await runner.query(`ALTER TABLE product_categories DROP COLUMN IF EXISTS depth;`);
  }
}
