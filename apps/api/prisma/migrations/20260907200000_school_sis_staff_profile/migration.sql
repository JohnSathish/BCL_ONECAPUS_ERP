-- Optional St. Luke's staff profile fields. Blanks stay null until the school fills them.

ALTER TABLE "school"."school_staff"
  ADD COLUMN IF NOT EXISTS "photo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "blood_group" TEXT,
  ADD COLUMN IF NOT EXISTS "date_of_birth" DATE,
  ADD COLUMN IF NOT EXISTS "father_spouse_name" TEXT,
  ADD COLUMN IF NOT EXISTS "academic_qualification" TEXT,
  ADD COLUMN IF NOT EXISTS "professional_qualification" TEXT,
  ADD COLUMN IF NOT EXISTS "teaching_experience" TEXT,
  ADD COLUMN IF NOT EXISTS "class_assigned" TEXT,
  ADD COLUMN IF NOT EXISTS "training_status" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "extras_json" JSONB NOT NULL DEFAULT '{}'::jsonb;
