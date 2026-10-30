ALTER TABLE "library"."library_loans"
  ADD COLUMN IF NOT EXISTS "receipt_no" TEXT;

CREATE INDEX IF NOT EXISTS "library_loans_tenant_id_receipt_no_idx"
  ON "library"."library_loans" ("tenant_id", "receipt_no");
