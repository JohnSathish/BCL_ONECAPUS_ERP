-- Semester contact hours (university compliance; not derived from credits)
ALTER TABLE "academic"."courses"
  ADD COLUMN IF NOT EXISTS "total_theory_contact_hours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_practical_contact_hours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_contact_hours" INTEGER NOT NULL DEFAULT 0;
