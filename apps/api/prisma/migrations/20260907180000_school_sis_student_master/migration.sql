-- Student Master profile fields, siblings, audit, guardian extras, document verification.

ALTER TABLE "school"."school_students"
  ADD COLUMN IF NOT EXISTS "caste_category" TEXT,
  ADD COLUMN IF NOT EXISTS "mother_tongue" TEXT,
  ADD COLUMN IF NOT EXISTS "languages_known" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "aadhaar_number" TEXT,
  ADD COLUMN IF NOT EXISTS "current_address" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "permanent_address" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "uses_transport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "transport_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "uses_hostel" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hostel_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "medical_health" TEXT,
  ADD COLUMN IF NOT EXISTS "allergies" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "medical_conditions" TEXT,
  ADD COLUMN IF NOT EXISTS "medications" TEXT,
  ADD COLUMN IF NOT EXISTS "emergency_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_branch" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_ifsc" TEXT,
  ADD COLUMN IF NOT EXISTS "remarks" TEXT;

ALTER TABLE "school"."school_guardians"
  ADD COLUMN IF NOT EXISTS "occupation" TEXT,
  ADD COLUMN IF NOT EXISTS "photo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "address" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "school"."school_student_guardians"
  ADD COLUMN IF NOT EXISTS "relationship" TEXT NOT NULL DEFAULT 'GUARDIAN';

ALTER TABLE "school"."school_enrollments"
  ADD COLUMN IF NOT EXISTS "admission_date" DATE;

ALTER TABLE "school"."school_student_previous_schools"
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "tc_date" DATE;

ALTER TABLE "school"."school_student_documents"
  ADD COLUMN IF NOT EXISTS "uploaded_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verified_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "school"."school_student_siblings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "sibling_student_id" UUID NOT NULL,
  "relationship" TEXT NOT NULL DEFAULT 'SIBLING',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_student_siblings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_student_siblings_student_id_sibling_student_id_key"
  ON "school"."school_student_siblings"("student_id", "sibling_student_id");

CREATE INDEX IF NOT EXISTS "school_student_siblings_tenant_id_student_id_idx"
  ON "school"."school_student_siblings"("tenant_id", "student_id");

ALTER TABLE "school"."school_student_siblings"
  DROP CONSTRAINT IF EXISTS "school_student_siblings_student_id_fkey";
ALTER TABLE "school"."school_student_siblings"
  ADD CONSTRAINT "school_student_siblings_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school"."school_student_siblings"
  DROP CONSTRAINT IF EXISTS "school_student_siblings_sibling_student_id_fkey";
ALTER TABLE "school"."school_student_siblings"
  ADD CONSTRAINT "school_student_siblings_sibling_student_id_fkey"
  FOREIGN KEY ("sibling_student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_student_audit_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "before_json" JSONB,
  "after_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_student_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_student_audit_logs_tenant_id_student_id_created_at_idx"
  ON "school"."school_student_audit_logs"("tenant_id", "student_id", "created_at");

ALTER TABLE "school"."school_student_audit_logs"
  DROP CONSTRAINT IF EXISTS "school_student_audit_logs_student_id_fkey";
ALTER TABLE "school"."school_student_audit_logs"
  ADD CONSTRAINT "school_student_audit_logs_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
