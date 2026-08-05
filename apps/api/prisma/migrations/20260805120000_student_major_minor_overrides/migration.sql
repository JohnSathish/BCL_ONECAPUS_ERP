-- Schema model StudentMajorMinorOverride existed without a migration.
-- Live import validate queries this table and 500s if missing (42P01).

CREATE TABLE IF NOT EXISTS "academic"."student_major_minor_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "major_subject_id" UUID NOT NULL,
    "minor_subject_id" UUID NOT NULL,
    "program_version_id" UUID,
    "shift_id" UUID,
    "academic_year_id" UUID,
    "effective_from_semester" INTEGER NOT NULL DEFAULT 1,
    "effective_to_semester" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "reason" TEXT NOT NULL,
    "approval_authority" TEXT NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ,
    "supporting_document_url" TEXT,
    "approval_ref" TEXT,
    "metadata" JSONB,
    "created_by_id" UUID,
    "revoked_by_id" UUID,
    "revoked_at" TIMESTAMPTZ,
    "revoked_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_major_minor_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_major_minor_overrides_tenant_id_student_id_status_idx"
    ON "academic"."student_major_minor_overrides"("tenant_id", "student_id", "status");

CREATE INDEX IF NOT EXISTS "student_major_minor_overrides_tenant_major_minor_idx"
    ON "academic"."student_major_minor_overrides"("tenant_id", "major_subject_id", "minor_subject_id");

CREATE INDEX IF NOT EXISTS "student_major_minor_overrides_tenant_pv_shift_year_idx"
    ON "academic"."student_major_minor_overrides"("tenant_id", "program_version_id", "shift_id", "academic_year_id");
