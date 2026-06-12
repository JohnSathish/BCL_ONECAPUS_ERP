-- Phase 2: attendance mode, lab flag, timetable slot metadata

ALTER TABLE "academic"."courses"
  ADD COLUMN IF NOT EXISTS "attendance_mode" TEXT NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS "lab_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requires_timetable_slots" BOOLEAN NOT NULL DEFAULT true;

UPDATE "academic"."courses"
SET
  "attendance_mode" = 'MENTOR_APPROVAL',
  "requires_timetable_slots" = false
WHERE "deleted_at" IS NULL
  AND "credit_calculation_mode" = 'MANUAL_OVERRIDE';

CREATE INDEX IF NOT EXISTS "courses_attendance_mode_idx"
  ON "academic"."courses" ("attendance_mode");
