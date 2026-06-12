-- Course master operational fields
ALTER TABLE "academic"."courses"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "syllabus_version" TEXT;

-- Section delivery: student cohort / group label (e.g. Arts, Science/Commerce)
ALTER TABLE "academic"."offering_sections"
  ADD COLUMN IF NOT EXISTS "student_group" TEXT;

-- Prevent duplicate curriculum mappings (same course slot in a program version)
CREATE UNIQUE INDEX IF NOT EXISTS "course_offerings_curriculum_slot_key"
  ON "academic"."course_offerings" (
    "program_version_id",
    "course_id",
    COALESCE("semester_sequence", -1),
    COALESCE("category", '')
  )
  WHERE "deleted_at" IS NULL;
