-- Student Profile Management: extended schema

ALTER TABLE "academic"."students"
  ADD COLUMN IF NOT EXISTS "application_number" TEXT,
  ADD COLUMN IF NOT EXISTS "admission_number" TEXT,
  ADD COLUMN IF NOT EXISTS "rfid_number" TEXT,
  ADD COLUMN IF NOT EXISTS "import_source" TEXT,
  ADD COLUMN IF NOT EXISTS "admission_source" TEXT,
  ADD COLUMN IF NOT EXISTS "created_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "last_modified_by_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "students_tenant_id_rfid_number_key"
  ON "academic"."students"("tenant_id", "rfid_number") WHERE "rfid_number" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "students_tenant_id_application_number_idx"
  ON "academic"."students"("tenant_id", "application_number");

CREATE INDEX IF NOT EXISTS "students_tenant_id_admission_number_idx"
  ON "academic"."students"("tenant_id", "admission_number");

ALTER TABLE "academic"."students"
  ADD CONSTRAINT "students_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."students"
  ADD CONSTRAINT "students_last_modified_by_id_fkey"
  FOREIGN KEY ("last_modified_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."student_profiles"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "marital_status" TEXT,
  ADD COLUMN IF NOT EXISTS "student_status" TEXT NOT NULL DEFAULT 'STUDYING',
  ADD COLUMN IF NOT EXISTS "tribe_lookup_id" UUID,
  ADD COLUMN IF NOT EXISTS "denomination_lookup_id" UUID,
  ADD COLUMN IF NOT EXISTS "differently_abled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ews" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "admission_type" TEXT,
  ADD COLUMN IF NOT EXISTS "admission_category" TEXT,
  ADD COLUMN IF NOT EXISTS "home_same_as_tura" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "student_profiles_national_id_idx"
  ON "academic"."student_profiles"("national_id");

CREATE INDEX IF NOT EXISTS "student_profiles_student_status_idx"
  ON "academic"."student_profiles"("student_status");

ALTER TABLE "academic"."student_documents"
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verified_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verification_remarks" TEXT;

CREATE INDEX IF NOT EXISTS "student_documents_verification_status_idx"
  ON "academic"."student_documents"("tenant_id", "verification_status");

ALTER TABLE "academic"."student_documents"
  ADD CONSTRAINT "student_documents_verified_by_id_fkey"
  FOREIGN KEY ("verified_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."semester_registration_lines"
  ADD COLUMN IF NOT EXISTS "assigned_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "assignment_source" TEXT;

ALTER TABLE "academic"."semester_registration_lines"
  ADD CONSTRAINT "semester_registration_lines_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_addresses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "address_type" TEXT NOT NULL,
  "line1" TEXT,
  "line2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "district" TEXT,
  "pin_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_addresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_addresses_student_id_address_type_key"
  ON "academic"."student_addresses"("student_id", "address_type");

CREATE INDEX IF NOT EXISTS "student_addresses_tenant_id_student_id_idx"
  ON "academic"."student_addresses"("tenant_id", "student_id");

ALTER TABLE "academic"."student_addresses"
  ADD CONSTRAINT "student_addresses_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_guardians" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "guardian_type" TEXT NOT NULL,
  "full_name" TEXT,
  "age" INTEGER,
  "occupation" TEXT,
  "contact_number" TEXT,
  "email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_guardians_student_id_guardian_type_key"
  ON "academic"."student_guardians"("student_id", "guardian_type");

CREATE INDEX IF NOT EXISTS "student_guardians_tenant_id_student_id_idx"
  ON "academic"."student_guardians"("tenant_id", "student_id");

ALTER TABLE "academic"."student_guardians"
  ADD CONSTRAINT "student_guardians_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_board_exams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "board_name" TEXT,
  "board_roll_number" TEXT,
  "exam_year" INTEGER,
  "stream" TEXT,
  "registration_type" TEXT,
  "total_marks" INTEGER,
  "percentage" DECIMAL(5,2),
  "division" TEXT,
  "marksheet_document_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_board_exams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_board_exams_marksheet_document_id_key"
  ON "academic"."student_board_exams"("marksheet_document_id");

CREATE INDEX IF NOT EXISTS "student_board_exams_tenant_id_student_id_idx"
  ON "academic"."student_board_exams"("tenant_id", "student_id");

ALTER TABLE "academic"."student_board_exams"
  ADD CONSTRAINT "student_board_exams_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_board_exams"
  ADD CONSTRAINT "student_board_exams_marksheet_document_id_fkey"
  FOREIGN KEY ("marksheet_document_id") REFERENCES "academic"."student_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_board_subject_marks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "board_exam_id" UUID NOT NULL,
  "subject_name" TEXT NOT NULL,
  "marks_obtained" INTEGER,
  "max_marks" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_board_subject_marks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_board_subject_marks_board_exam_id_idx"
  ON "academic"."student_board_subject_marks"("board_exam_id");

ALTER TABLE "academic"."student_board_subject_marks"
  ADD CONSTRAINT "student_board_subject_marks_board_exam_id_fkey"
  FOREIGN KEY ("board_exam_id") REFERENCES "academic"."student_board_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_cuet_details" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "cuet_applied" BOOLEAN NOT NULL DEFAULT false,
  "cuet_roll_number" TEXT,
  "cuet_score" DECIMAL(8,2),
  "cuet_subjects" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_cuet_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_cuet_details_student_id_key"
  ON "academic"."student_cuet_details"("student_id");

CREATE INDEX IF NOT EXISTS "student_cuet_details_tenant_id_idx"
  ON "academic"."student_cuet_details"("tenant_id");

ALTER TABLE "academic"."student_cuet_details"
  ADD CONSTRAINT "student_cuet_details_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_profile_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "section_key" TEXT NOT NULL,
  "field_key" TEXT NOT NULL,
  "old_value" TEXT,
  "new_value" TEXT,
  "actor_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_profile_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_profile_audit_logs_tenant_student_created_idx"
  ON "academic"."student_profile_audit_logs"("tenant_id", "student_id", "created_at");

ALTER TABLE "academic"."student_profile_audit_logs"
  ADD CONSTRAINT "student_profile_audit_logs_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_profile_audit_logs"
  ADD CONSTRAINT "student_profile_audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_profile_field_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "section_key" TEXT NOT NULL,
  "field_key" TEXT NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "editable" BOOLEAN NOT NULL DEFAULT true,
  "student_editable" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_profile_field_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_profile_field_configs_institution_section_field_key"
  ON "academic"."student_profile_field_configs"("institution_id", "section_key", "field_key");

CREATE INDEX IF NOT EXISTS "student_profile_field_configs_tenant_institution_idx"
  ON "academic"."student_profile_field_configs"("tenant_id", "institution_id");

ALTER TABLE "academic"."student_profile_field_configs"
  ADD CONSTRAINT "student_profile_field_configs_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
