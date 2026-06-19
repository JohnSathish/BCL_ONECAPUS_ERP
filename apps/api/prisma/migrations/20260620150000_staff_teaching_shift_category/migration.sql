-- staff_profiles.teaching_shift_category was in schema.prisma but never migrated
ALTER TABLE "academic"."staff_profiles"
  ADD COLUMN IF NOT EXISTS "teaching_shift_category" TEXT NOT NULL DEFAULT 'DAY';
