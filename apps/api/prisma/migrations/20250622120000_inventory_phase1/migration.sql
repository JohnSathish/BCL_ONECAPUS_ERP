-- Inventory Phase 1 — stores, items, stock transactions (issue/return/receipt)

CREATE TABLE IF NOT EXISTS "core"."inventory_stores" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_stores_tenant_id_code_key"
  ON "core"."inventory_stores"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_stores_tenant_id_status_idx"
  ON "core"."inventory_stores"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "core"."inventory_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'PCS',
  "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
  "reorder_level" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_items_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "core"."inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_tenant_id_sku_key"
  ON "core"."inventory_items"("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_id_store_id_status_idx"
  ON "core"."inventory_items"("tenant_id", "store_id", "status");
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_id_category_idx"
  ON "core"."inventory_items"("tenant_id", "category");

CREATE TABLE IF NOT EXISTS "core"."inventory_transactions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "transaction_type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "department" TEXT,
  "issued_to_name" TEXT,
  "issued_to_staff_id" UUID,
  "notes" TEXT,
  "performed_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_transactions_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "core"."inventory_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_transactions_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "core"."inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "inventory_transactions_tenant_id_item_id_created_at_idx"
  ON "core"."inventory_transactions"("tenant_id", "item_id", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_transactions_tenant_id_store_id_created_at_idx"
  ON "core"."inventory_transactions"("tenant_id", "store_id", "created_at");
CREATE INDEX IF NOT EXISTS "inventory_transactions_tenant_id_transaction_type_created_at_idx"
  ON "core"."inventory_transactions"("tenant_id", "transaction_type", "created_at");
