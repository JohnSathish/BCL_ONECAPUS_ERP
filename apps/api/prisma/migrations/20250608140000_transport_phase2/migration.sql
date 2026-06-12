-- Transport Phase 2 — capacity alerts, parent notification tracking

ALTER TABLE "core"."transport_routes"
  ADD COLUMN IF NOT EXISTS "capacity_warning_percent" INTEGER NOT NULL DEFAULT 90;

ALTER TABLE "core"."transport_student_assignments"
  ADD COLUMN IF NOT EXISTS "assigned_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "parent_notified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "notification_status" TEXT;
