-- Catch-up for stationery POS when earlier deploys created tables without later columns.

ALTER TABLE "school"."school_stationery_sales"
  ADD COLUMN IF NOT EXISTS "cash_received" INTEGER,
  ADD COLUMN IF NOT EXISTS "change_returned" INTEGER,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "school_stationery_sales_tenant_id_idempotency_key_key"
  ON "school"."school_stationery_sales"("tenant_id", "idempotency_key");

ALTER TABLE "school"."school_stationery_products"
  ADD COLUMN IF NOT EXISTS "subcategory_id" UUID,
  ADD COLUMN IF NOT EXISTS "grade_id" UUID,
  ADD COLUMN IF NOT EXISTS "academic_year_id" UUID,
  ADD COLUMN IF NOT EXISTS "opening_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "min_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "qty_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0;

ALTER TABLE "school"."school_stationery_product_variants"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
