ALTER TABLE "academic"."semester_registration_lines"
  ADD COLUMN IF NOT EXISTS "eligibility_override" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "eligibility_override_reason" TEXT;
