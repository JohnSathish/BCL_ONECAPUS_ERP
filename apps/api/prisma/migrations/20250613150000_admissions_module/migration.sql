-- Admissions Management Module: cycles, extended applications, documents, audit

CREATE TABLE IF NOT EXISTS "academic"."admission_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fyup_semester" INTEGER NOT NULL DEFAULT 1,
    "registration_opens_at" TIMESTAMP(3),
    "registration_closes_at" TIMESTAMP(3),
    "application_deadline" TIMESTAMP(3),
    "payment_deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "form_version" INTEGER NOT NULL DEFAULT 1,
    "application_seq" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "admission_cycles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admission_cycles_tenant_id_code_key" ON "academic"."admission_cycles"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "admission_cycles_tenant_id_status_idx" ON "academic"."admission_cycles"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "admission_cycles_academic_year_id_idx" ON "academic"."admission_cycles"("academic_year_id");

ALTER TABLE "academic"."admission_cycles"
  ADD CONSTRAINT "admission_cycles_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."admission_cycles"
  ADD CONSTRAINT "admission_cycles_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "core"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."admission_cycle_programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admission_cycle_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admission_cycle_programs_cycle_id_program_id_key" ON "academic"."admission_cycle_programs"("cycle_id", "program_id");
CREATE INDEX IF NOT EXISTS "admission_cycle_programs_tenant_id_idx" ON "academic"."admission_cycle_programs"("tenant_id");

ALTER TABLE "academic"."admission_cycle_programs"
  ADD CONSTRAINT "admission_cycle_programs_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "academic"."admission_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."admission_cycle_programs"
  ADD CONSTRAINT "admission_cycle_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."admission_intakes" ADD COLUMN IF NOT EXISTS "cycle_id" UUID;
CREATE INDEX IF NOT EXISTS "admission_intakes_cycle_id_idx" ON "academic"."admission_intakes"("cycle_id");
ALTER TABLE "academic"."admission_intakes"
  ADD CONSTRAINT "admission_intakes_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "academic"."admission_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."admission_applications" ALTER COLUMN "intake_id" DROP NOT NULL;
ALTER TABLE "academic"."admission_applications" ALTER COLUMN "academic_stream_id" DROP NOT NULL;
ALTER TABLE "academic"."admission_applications" ALTER COLUMN "merit_score" SET DEFAULT 0;

ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "cycle_id" UUID;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "applicant_user_id" UUID;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "program_id" UUID;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "form_data" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "current_step" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "progress_percent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "last_saved_at" TIMESTAMP(3);
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "payment_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "payment_reference" TEXT;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(12,2);
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "document_verification_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "major_subject_code" TEXT;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "minor_subject_code" TEXT;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "mdc_subject_code" TEXT;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "aec_subject_code" TEXT;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "sec_subject_code" TEXT;
ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "vac_subject_code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "admission_applications_applicant_user_id_key" ON "academic"."admission_applications"("applicant_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "admission_applications_cycle_id_application_number_key" ON "academic"."admission_applications"("cycle_id", "application_number");
CREATE INDEX IF NOT EXISTS "admission_applications_cycle_id_status_idx" ON "academic"."admission_applications"("cycle_id", "status");

ALTER TABLE "academic"."admission_applications"
  ADD CONSTRAINT "admission_applications_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "academic"."admission_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."admission_applications"
  ADD CONSTRAINT "admission_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."admission_applications"
  ADD CONSTRAINT "admission_applications_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."admission_application_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "slot_code" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admission_application_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admission_application_documents_application_id_slot_code_key" ON "academic"."admission_application_documents"("application_id", "slot_code");
CREATE INDEX IF NOT EXISTS "admission_application_documents_tenant_id_application_id_idx" ON "academic"."admission_application_documents"("tenant_id", "application_id");

ALTER TABLE "academic"."admission_application_documents"
  ADD CONSTRAINT "admission_application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "academic"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."admission_application_documents"
  ADD CONSTRAINT "admission_application_documents_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."admission_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "cycle_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admission_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admission_audit_logs_tenant_id_entity_type_entity_id_idx" ON "academic"."admission_audit_logs"("tenant_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "admission_audit_logs_cycle_id_idx" ON "academic"."admission_audit_logs"("cycle_id");

ALTER TABLE "academic"."admission_audit_logs"
  ADD CONSTRAINT "admission_audit_logs_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "academic"."admission_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."admission_audit_logs"
  ADD CONSTRAINT "admission_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
