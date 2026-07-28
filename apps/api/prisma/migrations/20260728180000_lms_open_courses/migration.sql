-- LMS Open Courses / Stream Resources catalog

CREATE TABLE IF NOT EXISTS "academic"."lms_open_courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stream" TEXT NOT NULL DEFAULT 'COMMON',
    "visibility" TEXT NOT NULL DEFAULT 'COLLEGE',
    "program_id" UUID,
    "moodle_course_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "lms_open_courses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lms_open_courses_tenant_id_status_visibility_idx"
  ON "academic"."lms_open_courses"("tenant_id", "status", "visibility");
CREATE INDEX IF NOT EXISTS "lms_open_courses_tenant_id_stream_idx"
  ON "academic"."lms_open_courses"("tenant_id", "stream");
CREATE INDEX IF NOT EXISTS "lms_open_courses_tenant_id_program_id_idx"
  ON "academic"."lms_open_courses"("tenant_id", "program_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lms_open_courses_program_id_fkey'
  ) THEN
    ALTER TABLE "academic"."lms_open_courses"
      ADD CONSTRAINT "lms_open_courses_program_id_fkey"
      FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
