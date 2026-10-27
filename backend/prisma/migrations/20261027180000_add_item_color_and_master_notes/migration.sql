-- CreateTable inventory_item_colors
CREATE TABLE IF NOT EXISTS "inventory_item_colors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "hex_code" VARCHAR(20),
  "description" TEXT,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_item_colors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_item_colors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_item_colors_company_id_code_key" ON "inventory_item_colors"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_item_colors_company_id_is_active_idx" ON "inventory_item_colors"("company_id", "is_active");

-- Add notes column to existing master tables if not exists
ALTER TABLE "inventory_categories" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "inventory_brands" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "inventory_product_types" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "inventory_item_sizes" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "inventory_origins" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "color_id" UUID;

-- Add foreign key constraint for color_id on inventory_items if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_color_id_fkey'
  ) THEN
    ALTER TABLE "inventory_items"
      ADD CONSTRAINT "inventory_items_color_id_fkey"
      FOREIGN KEY ("color_id") REFERENCES "inventory_item_colors"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "inventory_items_company_id_color_id_idx" ON "inventory_items"("company_id", "color_id");
