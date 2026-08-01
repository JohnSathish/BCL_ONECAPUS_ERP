-- Interactive Academic Calendar V1: extend academic_calendar_events
ALTER TABLE "academic"."academic_calendar_events"
  ADD COLUMN IF NOT EXISTS "color" TEXT,
  ADD COLUMN IF NOT EXISTS "icon" TEXT,
  ADD COLUMN IF NOT EXISTS "venue" TEXT,
  ADD COLUMN IF NOT EXISTS "is_all_day" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_recurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recurrence_rule" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrence_parent_id" UUID,
  ADD COLUMN IF NOT EXISTS "programme_id" UUID,
  ADD COLUMN IF NOT EXISTS "semester_id" UUID,
  ADD COLUMN IF NOT EXISTS "shift_id" UUID,
  ADD COLUMN IF NOT EXISTS "visibility_flags" JSONB,
  ADD COLUMN IF NOT EXISTS "attachment_urls" JSONB,
  ADD COLUMN IF NOT EXISTS "organizer_name" TEXT;

CREATE INDEX IF NOT EXISTS "academic_calendar_events_recurrence_parent_id_idx"
  ON "academic"."academic_calendar_events"("recurrence_parent_id");
