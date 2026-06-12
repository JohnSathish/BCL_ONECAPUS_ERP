ALTER TABLE "academic"."staff_documents"
  ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verification_remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "uploaded_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "issue_date" DATE,
  ADD COLUMN IF NOT EXISTS "expiry_date" DATE,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE "academic"."staff_documents"
SET "verification_status" = 'VERIFIED'
WHERE "verified_by_id" IS NOT NULL AND "verification_status" = 'PENDING';

CREATE INDEX IF NOT EXISTS "staff_documents_tenant_id_verification_status_idx"
  ON "academic"."staff_documents" ("tenant_id", "verification_status");

CREATE INDEX IF NOT EXISTS "staff_documents_tenant_id_expiry_date_idx"
  ON "academic"."staff_documents" ("tenant_id", "expiry_date");
