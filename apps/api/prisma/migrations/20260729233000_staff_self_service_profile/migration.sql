-- Staff self-service profile: personal/contact/bank fields + approval-backed child tables

ALTER TABLE "academic"."staff_profiles"
  ADD COLUMN IF NOT EXISTS "passport_no" TEXT,
  ADD COLUMN IF NOT EXISTS "marital_status" TEXT,
  ADD COLUMN IF NOT EXISTS "nationality" TEXT,
  ADD COLUMN IF NOT EXISTS "religion" TEXT,
  ADD COLUMN IF NOT EXISTS "alternate_mobile" TEXT,
  ADD COLUMN IF NOT EXISTS "personal_email" TEXT,
  ADD COLUMN IF NOT EXISTS "account_holder_name" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_branch" TEXT,
  ADD COLUMN IF NOT EXISTS "upi_id" TEXT;

ALTER TABLE "academic"."staff_qualifications"
  ADD COLUMN IF NOT EXISTS "institution" TEXT,
  ADD COLUMN IF NOT EXISTS "board" TEXT,
  ADD COLUMN IF NOT EXISTS "passing_year" INTEGER,
  ADD COLUMN IF NOT EXISTS "percentage_or_cgpa" TEXT,
  ADD COLUMN IF NOT EXISTS "division" TEXT,
  ADD COLUMN IF NOT EXISTS "certificate_url" TEXT,
  ADD COLUMN IF NOT EXISTS "approval_status" TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "review_remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reviewed_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "staff_qualifications_tenant_approval_idx"
  ON "academic"."staff_qualifications" ("tenant_id", "approval_status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_qualifications_reviewed_by_id_fkey'
  ) THEN
    ALTER TABLE "academic"."staff_qualifications"
      ADD CONSTRAINT "staff_qualifications_reviewed_by_id_fkey"
      FOREIGN KEY ("reviewed_by_id") REFERENCES "platform"."users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "academic"."staff_experiences" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "institution_name" TEXT NOT NULL,
  "designation" TEXT NOT NULL,
  "department" TEXT,
  "employment_type" TEXT,
  "from_date" DATE NOT NULL,
  "to_date" DATE,
  "total_months" INTEGER,
  "certificate_url" TEXT,
  "approval_status" TEXT NOT NULL DEFAULT 'PENDING',
  "review_remarks" TEXT,
  "submitted_at" TIMESTAMPTZ,
  "reviewed_at" TIMESTAMPTZ,
  "reviewed_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_experiences_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "staff_experiences_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "platform"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "staff_experiences_tenant_staff_idx"
  ON "academic"."staff_experiences" ("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "staff_experiences_tenant_approval_idx"
  ON "academic"."staff_experiences" ("tenant_id", "approval_status");

CREATE TABLE IF NOT EXISTS "academic"."staff_certifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "certification_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "organizer" TEXT,
  "year" INTEGER,
  "certificate_url" TEXT,
  "approval_status" TEXT NOT NULL DEFAULT 'PENDING',
  "review_remarks" TEXT,
  "submitted_at" TIMESTAMPTZ,
  "reviewed_at" TIMESTAMPTZ,
  "reviewed_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_certifications_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "staff_certifications_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "platform"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "staff_certifications_tenant_staff_idx"
  ON "academic"."staff_certifications" ("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "staff_certifications_tenant_approval_idx"
  ON "academic"."staff_certifications" ("tenant_id", "approval_status");

CREATE TABLE IF NOT EXISTS "academic"."staff_emergency_contacts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "contact_name" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "alternate_mobile" TEXT,
  "address" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_emergency_contacts_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "staff_emergency_contacts_tenant_staff_idx"
  ON "academic"."staff_emergency_contacts" ("tenant_id", "staff_profile_id");

CREATE TABLE IF NOT EXISTS "academic"."staff_profile_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "meta_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_profile_audit_logs_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "staff_profile_audit_logs_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "platform"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "staff_profile_audit_logs_tenant_staff_created_idx"
  ON "academic"."staff_profile_audit_logs" ("tenant_id", "staff_profile_id", "created_at");
