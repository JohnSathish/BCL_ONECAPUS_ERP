-- Student residence fields for directory hostel filters
ALTER TABLE "academic"."student_academic_profiles"
  ADD COLUMN IF NOT EXISTS "residence_type" TEXT,
  ADD COLUMN IF NOT EXISTS "hostel_block" TEXT,
  ADD COLUMN IF NOT EXISTS "hostel_room" TEXT;

CREATE INDEX IF NOT EXISTS "student_academic_profiles_tenant_residence_idx"
  ON "academic"."student_academic_profiles" ("tenant_id", "residence_type");
