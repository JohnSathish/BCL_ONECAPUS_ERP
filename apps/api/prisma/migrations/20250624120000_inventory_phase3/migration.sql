-- Inventory Phase 3 — vendor prices, requisitions, restock workflow

CREATE TABLE IF NOT EXISTS "core"."inventory_vendor_prices" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "vendor_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "unit_price" DECIMAL(10,2) NOT NULL,
  "min_order_qty" INTEGER NOT NULL DEFAULT 1,
  "lead_days" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_vendor_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_vendor_prices_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "core"."inventory_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_vendor_prices_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "core"."inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_vendor_prices_tenant_id_vendor_id_item_id_key"
  ON "core"."inventory_vendor_prices"("tenant_id", "vendor_id", "item_id");
CREATE INDEX IF NOT EXISTS "inventory_vendor_prices_tenant_id_item_id_status_idx"
  ON "core"."inventory_vendor_prices"("tenant_id", "item_id", "status");

CREATE TABLE IF NOT EXISTS "core"."inventory_requisitions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "requisition_no" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "requested_by_name" TEXT,
  "requested_by_staff_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "purchase_order_id" UUID,
  "approved_by_id" UUID,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_requisitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_requisitions_tenant_id_requisition_no_key"
  ON "core"."inventory_requisitions"("tenant_id", "requisition_no");
CREATE INDEX IF NOT EXISTS "inventory_requisitions_tenant_id_department_status_idx"
  ON "core"."inventory_requisitions"("tenant_id", "department", "status");
CREATE INDEX IF NOT EXISTS "inventory_requisitions_tenant_id_status_created_at_idx"
  ON "core"."inventory_requisitions"("tenant_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "core"."inventory_requisition_lines" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "requisition_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "quantity_requested" INTEGER NOT NULL,
  "quantity_approved" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_requisition_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_requisition_lines_requisition_id_fkey"
    FOREIGN KEY ("requisition_id") REFERENCES "core"."inventory_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inventory_requisition_lines_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "core"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_requisition_lines_tenant_id_requisition_id_idx"
  ON "core"."inventory_requisition_lines"("tenant_id", "requisition_id");

ALTER TABLE "core"."inventory_requisitions"
  ADD CONSTRAINT "inventory_requisitions_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id") REFERENCES "core"."inventory_purchase_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
