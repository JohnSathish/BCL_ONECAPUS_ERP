-- Phase 2: registration provenance + batch registration mode
ALTER TABLE "academic"."semester_registration_lines"
  ADD COLUMN IF NOT EXISTS "registration_source" TEXT;

ALTER TABLE "academic"."admission_batches"
  ADD COLUMN IF NOT EXISTS "registration_mode" TEXT NOT NULL DEFAULT 'ADMIN_ONLY';
