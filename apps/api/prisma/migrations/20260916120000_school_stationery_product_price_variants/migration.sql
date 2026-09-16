-- POS checkout requires product purchase/selling price and the variants table.

ALTER TABLE "school"."school_stationery_products"
  ADD COLUMN IF NOT EXISTS "purchase_price" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "selling_price" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_applicable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tax_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_allowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "opening_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "min_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "qty_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "school"."school_stationery_product_variants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "label" TEXT NOT NULL,
    "size" TEXT,
    "gender" TEXT,
    "colour" TEXT,
    "house" TEXT,
    "academic_year" TEXT,
    "purchase_price" INTEGER,
    "selling_price" INTEGER,
    "qty_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_stationery_product_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_stationery_product_variants_tenant_id_sku_key"
  ON "school"."school_stationery_product_variants"("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "school_stationery_product_variants_tenant_id_product_id_idx"
  ON "school"."school_stationery_product_variants"("tenant_id", "product_id");
