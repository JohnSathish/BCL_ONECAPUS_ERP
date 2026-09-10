-- Phase 1 enrollment spine for secondary school SIS (St. Luke's).
-- Copies existing SECONDARY_SIS core academic years into school.school_academic_years
-- using the same UUID so existing section/enrollment rows keep working.

CREATE TABLE "school"."school_academic_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_academic_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_academic_years_tenant_id_name_key" ON "school"."school_academic_years"("tenant_id", "name");
CREATE INDEX "school_academic_years_tenant_id_status_idx" ON "school"."school_academic_years"("tenant_id", "status");

INSERT INTO "school"."school_academic_years" (
    "id", "tenant_id", "name", "code", "start_date", "end_date", "status", "created_at", "updated_at", "deleted_at"
)
SELECT
    ay."id",
    ay."tenant_id",
    ay."name",
    COALESCE(substring(ay."name" FROM '^[0-9]{4}'), to_char(ay."start_date", 'YYYY')),
    ay."start_date",
    ay."end_date",
    ay."status",
    ay."created_at",
    ay."updated_at",
    ay."deleted_at"
FROM "core"."academic_years" ay
WHERE ay."id" IN (
    SELECT "academic_year_id" FROM "school"."school_sections"
    UNION
    SELECT "academic_year_id" FROM "school"."school_enrollments"
    UNION
    SELECT "academic_year_id" FROM "school"."school_grade_subjects"
)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "school"."school_id_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "school_id_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_id_sequences_tenant_year_kind_key" ON "school"."school_id_sequences"("tenant_id", "academic_year_id", "kind");

ALTER TABLE "school"."school_students"
    ADD COLUMN IF NOT EXISTS "email" TEXT,
    ADD COLUMN IF NOT EXISTS "address" TEXT,
    ADD COLUMN IF NOT EXISTS "blood_group" TEXT,
    ADD COLUMN IF NOT EXISTS "nationality" TEXT,
    ADD COLUMN IF NOT EXISTS "religion" TEXT,
    ADD COLUMN IF NOT EXISTS "photo_url" TEXT;

ALTER TABLE "school"."school_enrollments"
    ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'OFFICE',
    ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE "school"."school_enrollment_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "type" TEXT NOT NULL,
    "from_section_id" UUID,
    "to_section_id" UUID,
    "note" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_enrollment_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_enrollment_events_tenant_student_created_idx" ON "school"."school_enrollment_events"("tenant_id", "student_id", "created_at");

CREATE TABLE "school"."school_student_previous_schools" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "school_name" TEXT NOT NULL,
    "last_class" TEXT,
    "board" TEXT,
    "year_of_leaving" TEXT,
    "tc_number" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_student_previous_schools_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_student_previous_schools_tenant_student_idx" ON "school"."school_student_previous_schools"("tenant_id", "student_id");

CREATE TABLE "school"."school_student_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "slot" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_student_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_student_documents_tenant_student_idx" ON "school"."school_student_documents"("tenant_id", "student_id");

CREATE TABLE "school"."school_admission_cycles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "grade_id" UUID,
    "name" TEXT NOT NULL,
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "seat_cap" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_admission_cycles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_admission_cycles_tenant_status_idx" ON "school"."school_admission_cycles"("tenant_id", "status");

CREATE TABLE "school"."school_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "application_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "full_name" TEXT NOT NULL,
    "gender" TEXT,
    "date_of_birth" DATE,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "previous_school_name" TEXT,
    "previous_class" TEXT,
    "guardian_name" TEXT NOT NULL,
    "guardian_relation" TEXT NOT NULL DEFAULT 'Parent',
    "guardian_phone" TEXT,
    "guardian_email" TEXT,
    "student_id" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_applications_tenant_application_number_key" ON "school"."school_applications"("tenant_id", "application_number");
CREATE INDEX "school_applications_tenant_status_idx" ON "school"."school_applications"("tenant_id", "status");
CREATE INDEX "school_applications_tenant_cycle_idx" ON "school"."school_applications"("tenant_id", "cycle_id");

CREATE TABLE "school"."school_person_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "person_type" TEXT NOT NULL,
    "student_id" UUID,
    "guardian_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_person_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_person_accounts_tenant_user_type_key" ON "school"."school_person_accounts"("tenant_id", "user_id", "person_type");
CREATE INDEX "school_person_accounts_tenant_student_idx" ON "school"."school_person_accounts"("tenant_id", "student_id");
CREATE INDEX "school_person_accounts_tenant_guardian_idx" ON "school"."school_person_accounts"("tenant_id", "guardian_id");

ALTER TABLE "school"."school_id_sequences"
    ADD CONSTRAINT "school_id_sequences_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school"."school_sections"
    ADD CONSTRAINT "school_sections_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_grade_subjects"
    ADD CONSTRAINT "school_grade_subjects_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_enrollments"
    ADD CONSTRAINT "school_enrollments_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_class_teacher_assignments"
    ADD CONSTRAINT "school_class_teacher_assignments_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_subject_teacher_assignments"
    ADD CONSTRAINT "school_subject_teacher_assignments_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_enrollment_events"
    ADD CONSTRAINT "school_enrollment_events_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school"."school_enrollment_events"
    ADD CONSTRAINT "school_enrollment_events_enrollment_id_fkey"
    FOREIGN KEY ("enrollment_id") REFERENCES "school"."school_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "school"."school_student_previous_schools"
    ADD CONSTRAINT "school_student_previous_schools_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school"."school_student_documents"
    ADD CONSTRAINT "school_student_documents_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school"."school_admission_cycles"
    ADD CONSTRAINT "school_admission_cycles_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_applications"
    ADD CONSTRAINT "school_applications_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "school"."school_admission_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_applications"
    ADD CONSTRAINT "school_applications_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "school"."school_person_accounts"
    ADD CONSTRAINT "school_person_accounts_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school"."school_person_accounts"
    ADD CONSTRAINT "school_person_accounts_guardian_id_fkey"
    FOREIGN KEY ("guardian_id") REFERENCES "school"."school_guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
