-- Persist principal override reason when selecting Honours with Research
-- below the NEHU 75% Sem-6 aggregate threshold.
ALTER TABLE "academic"."student_academic_tracks"
ADD COLUMN IF NOT EXISTS "eligibility_override_reason" TEXT;
