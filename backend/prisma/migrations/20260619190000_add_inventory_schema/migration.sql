CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS "stock_movements" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "product_categories" CASCADE;
DROP TABLE IF EXISTS "units_of_measure" CASCADE;

DO $$ BEGIN
  CREATE TYPE "InventoryItemKind" AS ENUM (
    'RAW_MATERIAL',
    'FINISHED_GOOD',
    'SEMI_FINISHED',
    'SERVICE',
    'CONSUMABLE',
    'PACKAGING',
    'ASSET',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockValuationMethod" AS ENUM (
    'FIFO',
    'WEIGHTED_AVERAGE',
    'STANDARD_COST',
    'SPECIFIC_IDENTIFICATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockTrackingMethod" AS ENUM (
    'NONE',
    'BATCH',
    'SERIAL',
    'BATCH_AND_SERIAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ItemPriceKind" AS ENUM (
    'PURCHASE',
    'SALES',
    'WHOLESALE',
    'MINIMUM_SALES'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockMovementKind" AS ENUM (
    'OPENING_BALANCE',
    'PURCHASE_RECEIPT',
    'PURCHASE_RETURN',
    'SALES_DELIVERY',
    'SALES_RETURN',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'PRODUCTION_ISSUE',
    'PRODUCTION_RECEIPT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockSourceKind" AS ENUM (
    'OPENING_BALANCE',
    'PURCHASE_ORDER',
    'PURCHASE_INVOICE',
    'GOODS_RECEIPT',
    'SALES_ORDER',
    'SALES_INVOICE',
    'DELIVERY_NOTE',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'STOCK_ADJUSTMENT',
    'STOCK_TRANSFER',
    'PRODUCTION_ORDER',
    'MANUAL_ENTRY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "parent_id" UUID,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "level" INTEGER NOT NULL DEFAULT 0,
  "path" VARCHAR(1000) NOT NULL DEFAULT '',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "inventory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_categories_company_id_code_key" ON "inventory_categories"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_categories_company_id_is_active_idx" ON "inventory_categories"("company_id", "is_active");
CREATE INDEX IF NOT EXISTS "inventory_categories_parent_id_idx" ON "inventory_categories"("parent_id");

CREATE TABLE IF NOT EXISTS "inventory_item_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_item_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_item_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_item_groups_company_id_code_key" ON "inventory_item_groups"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_item_groups_company_id_is_active_idx" ON "inventory_item_groups"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_product_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_product_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_product_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_product_types_company_id_code_key" ON "inventory_product_types"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_product_types_company_id_is_active_idx" ON "inventory_product_types"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_brands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_brands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_brands_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_brands_company_id_code_key" ON "inventory_brands"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_brands_company_id_is_active_idx" ON "inventory_brands"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_item_sizes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_item_sizes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_item_sizes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_item_sizes_company_id_code_key" ON "inventory_item_sizes"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_item_sizes_company_id_is_active_idx" ON "inventory_item_sizes"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_origins" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_origins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_origins_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_origins_company_id_code_key" ON "inventory_origins"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_origins_company_id_is_active_idx" ON "inventory_origins"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_units_of_measure" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "short_name" VARCHAR(20) NOT NULL,
  "description" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_units_of_measure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_units_of_measure_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_units_of_measure_company_id_code_key" ON "inventory_units_of_measure"("company_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_units_of_measure_company_id_short_name_key" ON "inventory_units_of_measure"("company_id", "short_name");
CREATE INDEX IF NOT EXISTS "inventory_units_of_measure_company_id_is_active_idx" ON "inventory_units_of_measure"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_unit_conversions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "from_unit_id" UUID NOT NULL,
  "to_unit_id" UUID NOT NULL,
  "factor" DECIMAL(18, 6) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_unit_conversions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_unit_conversions_from_unit_id_fkey" FOREIGN KEY ("from_unit_id") REFERENCES "inventory_units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_unit_conversions_to_unit_id_fkey" FOREIGN KEY ("to_unit_id") REFERENCES "inventory_units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_unit_conversions_company_id_from_unit_id_to_unit_id_key" ON "inventory_unit_conversions"("company_id", "from_unit_id", "to_unit_id");
CREATE INDEX IF NOT EXISTS "inventory_unit_conversions_company_id_is_active_idx" ON "inventory_unit_conversions"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_warehouses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "address" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_warehouses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_warehouses_company_id_code_key" ON "inventory_warehouses"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_warehouses_company_id_is_active_idx" ON "inventory_warehouses"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_warehouse_locations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_warehouse_locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_warehouse_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_warehouse_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_warehouse_locations_warehouse_id_code_key" ON "inventory_warehouse_locations"("warehouse_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_warehouse_locations_company_id_is_active_idx" ON "inventory_warehouse_locations"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "item_code" VARCHAR(60) NOT NULL,
  "sku" VARCHAR(60),
  "item_name" VARCHAR(250) NOT NULL,
  "sale_description" TEXT,
  "detailed_description" TEXT,
  "category_id" UUID,
  "item_group_id" UUID,
  "product_type_id" UUID,
  "brand_id" UUID,
  "item_size_id" UUID,
  "origin_id" UUID,
  "base_uom_id" UUID,
  "stock_uom_id" UUID,
  "purchase_uom_id" UUID,
  "sales_uom_id" UUID,
  "item_kind" "InventoryItemKind" NOT NULL DEFAULT 'FINISHED_GOOD'::"InventoryItemKind",
  "valuation_method" "StockValuationMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE'::"StockValuationMethod",
  "tracking_method" "StockTrackingMethod" NOT NULL DEFAULT 'NONE'::"StockTrackingMethod",
  "is_inventory_item" BOOLEAN NOT NULL DEFAULT true,
  "is_sales_item" BOOLEAN NOT NULL DEFAULT true,
  "is_purchase_item" BOOLEAN NOT NULL DEFAULT true,
  "is_manufactured_item" BOOLEAN NOT NULL DEFAULT false,
  "is_service_item" BOOLEAN NOT NULL DEFAULT false,
  "standard_cost" DECIMAL(18, 4),
  "default_purchase_price" DECIMAL(18, 4),
  "default_sales_price" DECIMAL(18, 4),
  "minimum_sales_price" DECIMAL(18, 4),
  "wholesale_price" DECIMAL(18, 4),
  "purchase_discount_percent" DECIMAL(7, 4),
  "sales_discount_percent" DECIMAL(7, 4),
  "wholesale_discount_percent" DECIMAL(7, 4),
  "import_tax_percent" DECIMAL(7, 4),
  "packing" DECIMAL(18, 4),
  "weight" DECIMAL(18, 4),
  "weight_uom_id" UUID,
  "length" DECIMAL(18, 4),
  "width" DECIMAL(18, 4),
  "height" DECIMAL(18, 4),
  "dimension_uom_id" UUID,
  "minimum_stock_level" DECIMAL(18, 4),
  "maximum_stock_level" DECIMAL(18, 4),
  "reorder_level" DECIMAL(18, 4),
  "reorder_quantity" DECIMAL(18, 4),
  "default_warehouse_id" UUID,
  "default_location_id" UUID,
  "other_information" TEXT,
  "is_blocked" BOOLEAN NOT NULL DEFAULT false,
  "blocked_reason" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_item_group_id_fkey" FOREIGN KEY ("item_group_id") REFERENCES "inventory_item_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "inventory_product_types"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "inventory_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_item_size_id_fkey" FOREIGN KEY ("item_size_id") REFERENCES "inventory_item_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_origin_id_fkey" FOREIGN KEY ("origin_id") REFERENCES "inventory_origins"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_base_uom_id_fkey" FOREIGN KEY ("base_uom_id") REFERENCES "inventory_units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_stock_uom_id_fkey" FOREIGN KEY ("stock_uom_id") REFERENCES "inventory_units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_purchase_uom_id_fkey" FOREIGN KEY ("purchase_uom_id") REFERENCES "inventory_units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_sales_uom_id_fkey" FOREIGN KEY ("sales_uom_id") REFERENCES "inventory_units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_weight_uom_id_fkey" FOREIGN KEY ("weight_uom_id") REFERENCES "inventory_units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_dimension_uom_id_fkey" FOREIGN KEY ("dimension_uom_id") REFERENCES "inventory_units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_default_warehouse_id_fkey" FOREIGN KEY ("default_warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_default_location_id_fkey" FOREIGN KEY ("default_location_id") REFERENCES "inventory_warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_company_id_item_code_key" ON "inventory_items"("company_id", "item_code");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_company_id_sku_key" ON "inventory_items"("company_id", "sku");
CREATE INDEX IF NOT EXISTS "inventory_items_company_id_is_active_idx" ON "inventory_items"("company_id", "is_active");
CREATE INDEX IF NOT EXISTS "inventory_items_company_id_category_id_idx" ON "inventory_items"("company_id", "category_id");
CREATE INDEX IF NOT EXISTS "inventory_items_company_id_brand_id_idx" ON "inventory_items"("company_id", "brand_id");

CREATE TABLE IF NOT EXISTS "inventory_item_prices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "price_kind" "ItemPriceKind" NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
  "price" DECIMAL(18, 4) NOT NULL,
  "discount_percent" DECIMAL(7, 4),
  "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
  "effective_to" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_item_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_item_prices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_item_prices_company_id_item_id_price_kind_idx" ON "inventory_item_prices"("company_id", "item_id", "price_kind");
CREATE INDEX IF NOT EXISTS "inventory_item_prices_company_id_is_active_idx" ON "inventory_item_prices"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_item_barcodes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "barcode" VARCHAR(100) NOT NULL,
  "label" VARCHAR(120),
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_item_barcodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_item_barcodes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_item_barcodes_company_id_barcode_key" ON "inventory_item_barcodes"("company_id", "barcode");
CREATE INDEX IF NOT EXISTS "inventory_item_barcodes_company_id_item_id_idx" ON "inventory_item_barcodes"("company_id", "item_id");
CREATE INDEX IF NOT EXISTS "inventory_item_barcodes_company_id_is_active_idx" ON "inventory_item_barcodes"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_item_images" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "image_url" TEXT NOT NULL,
  "label" VARCHAR(120),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_item_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_item_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_item_images_company_id_item_id_idx" ON "inventory_item_images"("company_id", "item_id");
CREATE INDEX IF NOT EXISTS "inventory_item_images_company_id_is_active_idx" ON "inventory_item_images"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_item_attributes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "value" VARCHAR(500) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_item_attributes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_item_attributes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_item_attributes_company_id_item_id_idx" ON "inventory_item_attributes"("company_id", "item_id");
CREATE INDEX IF NOT EXISTS "inventory_item_attributes_company_id_is_active_idx" ON "inventory_item_attributes"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_stock_balances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "location_id" UUID,
  "stock_on_hand" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "reserved_stock" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "available_stock" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "average_cost" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "total_stock_value" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_stock_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_stock_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_stock_balances_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_stock_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_stock_balances_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_stock_balances_company_id_item_id_warehouse_id_location_id_key" ON "inventory_stock_balances"("company_id", "item_id", "warehouse_id", "location_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_stock_balances_no_location_key" ON "inventory_stock_balances"("company_id", "item_id", "warehouse_id") WHERE "location_id" IS NULL;
CREATE INDEX IF NOT EXISTS "inventory_stock_balances_company_id_item_id_idx" ON "inventory_stock_balances"("company_id", "item_id");
CREATE INDEX IF NOT EXISTS "inventory_stock_balances_company_id_warehouse_id_idx" ON "inventory_stock_balances"("company_id", "warehouse_id");
CREATE INDEX IF NOT EXISTS "inventory_stock_balances_company_id_is_active_idx" ON "inventory_stock_balances"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "inventory_stock_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "location_id" UUID,
  "movement_date" DATE NOT NULL,
  "movement_kind" "StockMovementKind" NOT NULL,
  "source_kind" "StockSourceKind" NOT NULL,
  "source_document_id" UUID,
  "source_document_number" VARCHAR(60),
  "quantity_in" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "quantity_out" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(18, 4),
  "total_cost" DECIMAL(18, 4),
  "stock_after_movement" DECIMAL(18, 4),
  "valuation_method" "StockValuationMethod" NOT NULL,
  "remarks" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_stock_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_stock_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_stock_movements_company_id_item_id_movement_date_idx" ON "inventory_stock_movements"("company_id", "item_id", "movement_date");
CREATE INDEX IF NOT EXISTS "inventory_stock_movements_company_id_warehouse_id_movement_date_idx" ON "inventory_stock_movements"("company_id", "warehouse_id", "movement_date");
CREATE INDEX IF NOT EXISTS "inventory_stock_movements_company_id_source_kind_source_document_id_idx" ON "inventory_stock_movements"("company_id", "source_kind", "source_document_id");
CREATE INDEX IF NOT EXISTS "inventory_stock_movements_company_id_is_active_idx" ON "inventory_stock_movements"("company_id", "is_active");
