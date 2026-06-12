-- Add per-course eligibility rules (streams, programmes, majors, Class XII, prior study).
ALTER TABLE "academic"."courses"
  ADD COLUMN IF NOT EXISTS "eligibility_rules" JSONB NOT NULL DEFAULT '{}';
