-- Extended student profile fields for full bulk admission import
ALTER TABLE "academic"."students"
  ADD COLUMN IF NOT EXISTS "form_number" TEXT,
  ADD COLUMN IF NOT EXISTS "university_roll_number" TEXT,
  ADD COLUMN IF NOT EXISTS "university_registration_number" TEXT,
  ADD COLUMN IF NOT EXISTS "library_card_number" TEXT;

ALTER TABLE "academic"."student_profiles"
  ADD COLUMN IF NOT EXISTS "whatsapp_number" TEXT;

CREATE INDEX IF NOT EXISTS "students_tenant_university_roll_idx"
  ON "academic"."students"("tenant_id", "university_roll_number")
  WHERE "university_roll_number" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "students_tenant_university_reg_idx"
  ON "academic"."students"("tenant_id", "university_registration_number")
  WHERE "university_registration_number" IS NOT NULL;
