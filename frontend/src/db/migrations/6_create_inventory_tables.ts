import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryTables1745000000006 implements MigrationInterface {
  name = 'CreateInventoryTables1745000000006';

  public async up(runner: QueryRunner): Promise<void> {

    /* ── Product Categories ─────────────────────────────────────── */
    await runner.query(`
      CREATE TABLE product_categories (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id   UUID NOT NULL,
        code         VARCHAR(20)  NOT NULL,
        name         VARCHAR(150) NOT NULL,
        description  TEXT,
        parent_id    UUID REFERENCES product_categories(id) ON DELETE SET NULL,
        sort_order   INT  NOT NULL DEFAULT 0,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_cat_company_code UNIQUE (company_id, code)
      );
    `);
    await runner.query(`CREATE INDEX idx_product_categories_company ON product_categories(company_id);`);
    await runner.query(`CREATE INDEX idx_product_categories_parent  ON product_categories(parent_id);`);

    /* ── Units of Measure ───────────────────────────────────────── */
    await runner.query(`
      CREATE TABLE units_of_measure (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id   UUID NOT NULL,
        name         VARCHAR(80)  NOT NULL,
        abbreviation VARCHAR(20)  NOT NULL,
        uom_type     VARCHAR(20)  NOT NULL DEFAULT 'Quantity',
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        is_default   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_uom_company_abbr UNIQUE (company_id, abbreviation)
      );
    `);
    await runner.query(`CREATE INDEX idx_uom_company ON units_of_measure(company_id);`);

    /* ── Products ───────────────────────────────────────────────── */
    await runner.query(`
      CREATE TABLE products (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id      UUID NOT NULL,
        sku             VARCHAR(60)  NOT NULL,
        barcode         VARCHAR(100),
        name            VARCHAR(250) NOT NULL,
        description     TEXT,
        brand           VARCHAR(100),
        model           VARCHAR(100),
        category_id     UUID REFERENCES product_categories(id) ON DELETE SET NULL,
        uom_id          UUID REFERENCES units_of_measure(id)   ON DELETE SET NULL,
        product_type    VARCHAR(30)  NOT NULL DEFAULT 'Finished',
        status          VARCHAR(20)  NOT NULL DEFAULT 'Active',
        is_sellable     BOOLEAN NOT NULL DEFAULT TRUE,
        is_purchasable  BOOLEAN NOT NULL DEFAULT TRUE,
        cost_price      NUMERIC(18,4) NOT NULL DEFAULT 0,
        sale_price      NUMERIC(18,4) NOT NULL DEFAULT 0,
        min_sale_price  NUMERIC(18,4),
        tax_category    VARCHAR(20) NOT NULL DEFAULT 'Standard',
        tax_rate        NUMERIC(6,2) NOT NULL DEFAULT 0,
        qty_on_hand     NUMERIC(18,4) NOT NULL DEFAULT 0,
        qty_reserved    NUMERIC(18,4) NOT NULL DEFAULT 0,
        min_stock_level NUMERIC(18,4),
        max_stock_level NUMERIC(18,4),
        reorder_qty     NUMERIC(18,4),
        track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
        weight          NUMERIC(10,3),
        weight_unit     VARCHAR(10),
        length_cm       NUMERIC(10,3),
        width_cm        NUMERIC(10,3),
        height_cm       NUMERIC(10,3),
        image_url       TEXT,
        notes           TEXT,
        tags            VARCHAR(500),
        sort_order      INT NOT NULL DEFAULT 0,
        created_by      UUID,
        updated_by      UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_product_company_sku    UNIQUE (company_id, sku)
      );
    `);

    await runner.query(`CREATE UNIQUE INDEX idx_product_barcode ON products(company_id, barcode) WHERE barcode IS NOT NULL;`);
    await runner.query(`CREATE INDEX idx_products_company          ON products(company_id);`);
    await runner.query(`CREATE INDEX idx_products_company_status   ON products(company_id, status);`);
    await runner.query(`CREATE INDEX idx_products_company_category ON products(company_id, category_id);`);
    await runner.query(`CREATE INDEX idx_products_company_type     ON products(company_id, product_type);`);
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE IF EXISTS products;`);
    await runner.query(`DROP TABLE IF EXISTS units_of_measure;`);
    await runner.query(`DROP TABLE IF EXISTS product_categories;`);
  }
}
