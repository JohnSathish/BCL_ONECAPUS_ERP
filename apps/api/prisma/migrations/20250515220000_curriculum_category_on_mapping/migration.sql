-- NEP category is contextual (curriculum mapping only), not course identity
ALTER TABLE "academic"."courses" DROP COLUMN IF EXISTS "primary_category";

-- Optional ordering within a programme version semester
ALTER TABLE "academic"."course_offerings"
  ADD COLUMN IF NOT EXISTS "display_order" INTEGER;
