-- Flexible student attendance collection modes + institution settings

ALTER TABLE "platform"."tenant_attendance_policies"
  ADD COLUMN IF NOT EXISTS "allow_edit_after_submit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "platform"."tenant_attendance_policies"
  ADD COLUMN IF NOT EXISTS "attendance_cutoff_time" TEXT;

ALTER TABLE "platform"."tenant_attendance_policies"
  ADD COLUMN IF NOT EXISTS "late_grace_minutes" INTEGER;

ALTER TABLE "platform"."tenant_attendance_policies"
  ADD COLUMN IF NOT EXISTS "late_policy" TEXT NOT NULL DEFAULT 'NONE';

ALTER TABLE "platform"."tenant_attendance_policies"
  ADD COLUMN IF NOT EXISTS "default_attendance_status" TEXT NOT NULL DEFAULT 'P';

ALTER TABLE "platform"."tenant_attendance_policies"
  ADD COLUMN IF NOT EXISTS "weekend_holiday_handling" TEXT NOT NULL DEFAULT 'SKIP_NON_WORKING';
