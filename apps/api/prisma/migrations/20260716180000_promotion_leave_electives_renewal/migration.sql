-- Digitize semester subject renewal: promotion may leave draft registrations
-- with compulsory lines only so students complete electives in a renewal window.
ALTER TABLE "academic"."semester_promotion_runs"
  ADD COLUMN IF NOT EXISTS "leave_electives_for_student_renewal" BOOLEAN NOT NULL DEFAULT true;
