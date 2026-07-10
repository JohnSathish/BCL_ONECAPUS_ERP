-- Student Profile Update & Verification (Phase 1)

ALTER TABLE "academic"."student_profiles"
  ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
  ADD COLUMN IF NOT EXISTS "account_holder_name" TEXT,
  ADD COLUMN IF NOT EXISTS "account_number" TEXT,
  ADD COLUMN IF NOT EXISTS "ifsc" TEXT,
  ADD COLUMN IF NOT EXISTS "branch_name" TEXT,
  ADD COLUMN IF NOT EXISTS "emergency_contact_name" TEXT,
  ADD COLUMN IF NOT EXISTS "emergency_contact_relation" TEXT,
  ADD COLUMN IF NOT EXISTS "emergency_contact_mobile" TEXT,
  ADD COLUMN IF NOT EXISTS "pan_number" TEXT,
  ADD COLUMN IF NOT EXISTS "alternate_mobile" TEXT;

ALTER TABLE "academic"."student_board_exams"
  ADD COLUMN IF NOT EXISTS "maximum_marks" INTEGER,
  ADD COLUMN IF NOT EXISTS "grade" TEXT,
  ADD COLUMN IF NOT EXISTS "registration_number" TEXT,
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "academic"."student_board_subject_marks"
  ADD COLUMN IF NOT EXISTS "grade" TEXT;

CREATE INDEX IF NOT EXISTS "student_board_exams_tenant_id_verification_status_idx"
  ON "academic"."student_board_exams"("tenant_id", "verification_status");

CREATE TABLE IF NOT EXISTS "academic"."student_profile_update_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "section_key" TEXT NOT NULL,
  "field_key" TEXT NOT NULL,
  "approval_mode" TEXT NOT NULL DEFAULT 'APPROVAL_REQUIRED',
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_profile_update_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_profile_update_policies_tenant_section_field_key"
  ON "academic"."student_profile_update_policies"("tenant_id", "section_key", "field_key");

CREATE INDEX IF NOT EXISTS "student_profile_update_policies_tenant_mode_idx"
  ON "academic"."student_profile_update_policies"("tenant_id", "approval_mode");

ALTER TABLE "academic"."student_profile_update_policies"
  DROP CONSTRAINT IF EXISTS "student_profile_update_policies_tenant_id_fkey";
ALTER TABLE "academic"."student_profile_update_policies"
  ADD CONSTRAINT "student_profile_update_policies_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_profile_change_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "submitted_at" TIMESTAMP(3),
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "remarks" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_profile_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_profile_change_requests_tenant_status_idx"
  ON "academic"."student_profile_change_requests"("tenant_id", "status", "submitted_at");
CREATE INDEX IF NOT EXISTS "student_profile_change_requests_tenant_student_idx"
  ON "academic"."student_profile_change_requests"("tenant_id", "student_id", "created_at");

ALTER TABLE "academic"."student_profile_change_requests"
  DROP CONSTRAINT IF EXISTS "student_profile_change_requests_tenant_id_fkey";
ALTER TABLE "academic"."student_profile_change_requests"
  ADD CONSTRAINT "student_profile_change_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_profile_change_requests"
  DROP CONSTRAINT IF EXISTS "student_profile_change_requests_student_id_fkey";
ALTER TABLE "academic"."student_profile_change_requests"
  ADD CONSTRAINT "student_profile_change_requests_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_profile_change_requests"
  DROP CONSTRAINT IF EXISTS "student_profile_change_requests_reviewed_by_id_fkey";
ALTER TABLE "academic"."student_profile_change_requests"
  ADD CONSTRAINT "student_profile_change_requests_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "platform"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_profile_change_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "request_id" UUID NOT NULL,
  "section_key" TEXT NOT NULL,
  "field_key" TEXT NOT NULL,
  "old_value" TEXT,
  "new_value" TEXT,
  "approval_status" TEXT NOT NULL DEFAULT 'PENDING',
  "auto_approved" BOOLEAN NOT NULL DEFAULT false,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_remarks" TEXT,
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_profile_change_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_profile_change_items_tenant_status_idx"
  ON "academic"."student_profile_change_items"("tenant_id", "approval_status");
CREATE INDEX IF NOT EXISTS "student_profile_change_items_request_id_idx"
  ON "academic"."student_profile_change_items"("request_id");

ALTER TABLE "academic"."student_profile_change_items"
  DROP CONSTRAINT IF EXISTS "student_profile_change_items_request_id_fkey";
ALTER TABLE "academic"."student_profile_change_items"
  ADD CONSTRAINT "student_profile_change_items_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "academic"."student_profile_change_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_profile_change_items"
  DROP CONSTRAINT IF EXISTS "student_profile_change_items_reviewed_by_id_fkey";
ALTER TABLE "academic"."student_profile_change_items"
  ADD CONSTRAINT "student_profile_change_items_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "platform"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
