-- Weekly timetable: Mon–Fri printed bells, confirmation flags, never touch college tables.

ALTER TABLE "school"."school_timetable_slots"
  ADD COLUMN IF NOT EXISTS "printed_subject" TEXT,
  ADD COLUMN IF NOT EXISTS "printed_teacher" TEXT,
  ADD COLUMN IF NOT EXISTS "needs_confirmation" BOOLEAN NOT NULL DEFAULT false;

UPDATE "school"."school_timetable_bells"
SET
  "label" = 'Short Break',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'R1' AND "kind" = 'BREAK' AND "label" ILIKE '%recess%';

UPDATE "school"."school_timetable_bells"
SET
  "label" = 'Lunch/Break',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'R2' AND "kind" = 'BREAK' AND "label" ILIKE '%recess%';

UPDATE "school"."school_timetable_plans"
SET
  "days_json" = '[1,2,3,4,5]'::jsonb,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "days_json" = '[1,2,3,4,5,6]'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM "school"."school_timetable_slots" s
    WHERE s.plan_id = "school"."school_timetable_plans".id AND s.day_of_week = 6
  );
