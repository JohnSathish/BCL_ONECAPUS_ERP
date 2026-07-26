-- Careers Application PDF package: PDF metadata + verify token
ALTER TABLE "academic"."recruitment_applications"
  ADD COLUMN IF NOT EXISTS "application_pdf_url" TEXT,
  ADD COLUMN IF NOT EXISTS "application_pdf_generated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verify_token" UUID,
  ADD COLUMN IF NOT EXISTS "content_hash" TEXT;

CREATE INDEX IF NOT EXISTS "recruitment_applications_tenant_id_verify_token_idx"
  ON "academic"."recruitment_applications"("tenant_id", "verify_token");
