-- School SIS homework (schema school). Not college LMS assignments.

CREATE TABLE IF NOT EXISTS "school"."school_homework" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "subject_id" UUID,
    "staff_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "assign_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "visible_to" TEXT NOT NULL DEFAULT 'STUDENTS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_homework_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_homework_staff_idx"
  ON "school"."school_homework"("tenant_id", "staff_id", "assign_date");
CREATE INDEX IF NOT EXISTS "school_homework_section_idx"
  ON "school"."school_homework"("tenant_id", "section_id", "due_date");

CREATE TABLE IF NOT EXISTS "school"."school_homework_files" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "homework_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_homework_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_homework_files_hw_idx"
  ON "school"."school_homework_files"("tenant_id", "homework_id");

CREATE TABLE IF NOT EXISTS "school"."school_homework_submissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "homework_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "remark" TEXT,
    CONSTRAINT "school_homework_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_homework_submissions_unique"
  ON "school"."school_homework_submissions"("tenant_id", "homework_id", "student_id");
CREATE INDEX IF NOT EXISTS "school_homework_submissions_student_idx"
  ON "school"."school_homework_submissions"("tenant_id", "student_id");

ALTER TABLE "school"."school_homework"
  ADD CONSTRAINT "school_homework_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_homework"
  ADD CONSTRAINT "school_homework_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_homework"
  ADD CONSTRAINT "school_homework_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "school"."school_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_homework"
  ADD CONSTRAINT "school_homework_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_homework_files"
  ADD CONSTRAINT "school_homework_files_homework_id_fkey"
  FOREIGN KEY ("homework_id") REFERENCES "school"."school_homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school"."school_homework_submissions"
  ADD CONSTRAINT "school_homework_submissions_homework_id_fkey"
  FOREIGN KEY ("homework_id") REFERENCES "school"."school_homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_homework_submissions"
  ADD CONSTRAINT "school_homework_submissions_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
