-- School SIS attendance policy + class rules. Not college staff attendance.

ALTER TABLE "school"."school_attendance_settings"
  ADD COLUMN IF NOT EXISTS "policy" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "school"."school_attendance_statuses"
  ADD COLUMN IF NOT EXISTS "short_code" TEXT NOT NULL DEFAULT '';

UPDATE "school"."school_attendance_statuses"
SET "short_code" = CASE "code"
  WHEN 'PRESENT' THEN 'P'
  WHEN 'ABSENT' THEN 'A'
  WHEN 'LATE' THEN 'L'
  WHEN 'LEAVE' THEN 'LV'
  WHEN 'HALF_DAY' THEN 'H'
  WHEN 'EXCUSED' THEN 'E'
  ELSE LEFT("code", 2)
END
WHERE "short_code" = '';

CREATE TABLE IF NOT EXISTS "school"."school_attendance_class_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "section_id" UUID,
    "mode" TEXT NOT NULL DEFAULT 'DAILY',
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_attendance_class_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_attendance_class_rules_scope_idx"
  ON "school"."school_attendance_class_rules"("tenant_id", "academic_year_id", "grade_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_attendance_class_rules_year_fkey'
  ) THEN
    ALTER TABLE "school"."school_attendance_class_rules"
      ADD CONSTRAINT "school_attendance_class_rules_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_attendance_class_rules_grade_fkey'
  ) THEN
    ALTER TABLE "school"."school_attendance_class_rules"
      ADD CONSTRAINT "school_attendance_class_rules_grade_fkey"
      FOREIGN KEY ("grade_id") REFERENCES "school"."school_grades"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_attendance_class_rules_section_fkey'
  ) THEN
    ALTER TABLE "school"."school_attendance_class_rules"
      ADD CONSTRAINT "school_attendance_class_rules_section_fkey"
      FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "school_attendance_class_rules_scope_key"
  ON "school"."school_attendance_class_rules"(
    "tenant_id",
    "academic_year_id",
    "grade_id",
    COALESCE("section_id", '00000000-0000-0000-0000-000000000000'::uuid)
  );
