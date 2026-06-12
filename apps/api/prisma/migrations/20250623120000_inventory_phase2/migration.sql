-- Inventory Phase 2 — barcodes, vendors, purchase orders

ALTER TABLE "core"."inventory_items" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
UPDATE "core"."inventory_items" SET "barcode" = "sku" WHERE "barcode" IS NULL;
ALTER TABLE "core"."inventory_items" ALTER COLUMN "barcode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_id_barcode_key"
  ON "core"."inventory_items"("tenant_id", "barcode");

ALTER TABLE "core"."inventory_transactions" ADD COLUMN IF NOT EXISTS "purchase_order_id" UUID;
CREATE INDEX IF NOT EXISTS "inventory_transactions_tenant_id_purchase_order_id_idx"
  ON "core"."inventory_transactions"("tenant_id", "purchase_order_id");

CREATE TABLE IF NOT EXISTS "core"."inventory_vendors" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contact_name" TEXT,
  "mobile" TEXT,
  "email" TEXT,
  "address" TEXT,
  "gstin" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_vendors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_vendors_tenant_id_code_key"
  ON "core"."inventory_vendors"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_vendors_tenant_id_status_idx"
  ON "core"."inventory_vendors"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "core"."inventory_purchase_orders" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "po_number" TEXT NOT NULL,
  "vendor_id" UUID NOT NULL,
  "store_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expected_date" TIMESTAMP(3),
  "notes" TEXT,
  "total_amount" DECIMAL(12,2),
  "created_by_id" UUID,
  "submitted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_purchase_orders_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "core"."inventory_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_purchase_orders_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "core"."inventory_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_purchase_orders_tenant_id_po_number_key"
  ON "core"."inventory_purchase_orders"("tenant_id", "po_number");
CREATE INDEX IF NOT EXISTS "inventory_purchase_orders_tenant_id_vendor_id_status_idx"
  ON "core"."inventory_purchase_orders"("tenant_id", "vendor_id", "status");
CREATE INDEX IF NOT EXISTS "inventory_purchase_orders_tenant_id_status_order_date_idx"
  ON "core"."inventory_purchase_orders"("tenant_id", "status", "order_date");

CREATE TABLE IF NOT EXISTS "core"."inventory_purchase_order_lines" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "purchase_order_id" UUID NOT NULL,
  "item_id" UUID,
  "description" TEXT NOT NULL,
  "sku" TEXT,
  "quantity_ordered" INTEGER NOT NULL,
  "quantity_received" INTEGER NOT NULL DEFAULT 0,
  "unit_price" DECIMAL(10,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_purchase_order_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_purchase_order_lines_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "core"."inventory_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_purchase_order_lines_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "core"."inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_purchase_order_lines_tenant_id_purchase_order_id_idx"
  ON "core"."inventory_purchase_order_lines"("tenant_id", "purchase_order_id");

ALTER TABLE "core"."inventory_transactions"
  ADD CONSTRAINT "inventory_transactions_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "core"."inventory_purchase_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
