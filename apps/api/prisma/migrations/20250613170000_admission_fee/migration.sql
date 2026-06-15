ALTER TABLE "academic"."admission_applications"
  ADD COLUMN IF NOT EXISTS "admission_fee_status" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE';

ALTER TABLE "academic"."admission_applications"
  ADD COLUMN IF NOT EXISTS "admission_fee_amount" DECIMAL(12,2);

ALTER TABLE "academic"."admission_applications"
  ADD COLUMN IF NOT EXISTS "admission_fee_reference" TEXT;

CREATE INDEX IF NOT EXISTS "admission_applications_admission_fee_status_idx"
  ON "academic"."admission_applications"("admission_fee_status");
