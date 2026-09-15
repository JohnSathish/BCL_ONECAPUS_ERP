-- Tender snapshot and idempotent stationery POS completions.

ALTER TABLE "school"."school_stationery_sales"
  ADD COLUMN IF NOT EXISTS "cash_received" INTEGER,
  ADD COLUMN IF NOT EXISTS "change_returned" INTEGER,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "school_stationery_sales_tenant_id_idempotency_key_key"
  ON "school"."school_stationery_sales"("tenant_id", "idempotency_key");
