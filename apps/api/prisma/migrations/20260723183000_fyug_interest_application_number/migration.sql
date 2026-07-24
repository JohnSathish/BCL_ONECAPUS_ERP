-- AlterTable
ALTER TABLE "academic"."website_fyug_interests"
  ADD COLUMN IF NOT EXISTS "application_number" TEXT,
  ADD COLUMN IF NOT EXISTS "academic_session" TEXT NOT NULL DEFAULT '2026-2027',
  ADD COLUMN IF NOT EXISTS "back_paper_details" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "remarks" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "website_fyug_interests_site_id_application_number_key"
  ON "academic"."website_fyug_interests"("site_id", "application_number");
