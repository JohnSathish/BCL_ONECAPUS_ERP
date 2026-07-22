-- Website academic department showcase publish layer
ALTER TABLE "academic"."staff_profiles"
  ADD COLUMN IF NOT EXISTS "show_on_website" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "website_slug" TEXT,
  ADD COLUMN IF NOT EXISTS "public_email" TEXT,
  ADD COLUMN IF NOT EXISTS "public_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "office_location" TEXT,
  ADD COLUMN IF NOT EXISTS "google_scholar_url" TEXT,
  ADD COLUMN IF NOT EXISTS "orcid_url" TEXT,
  ADD COLUMN IF NOT EXISTS "research_areas" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_tenant_id_website_slug_key"
  ON "academic"."staff_profiles"("tenant_id", "website_slug");

CREATE INDEX IF NOT EXISTS "staff_profiles_tenant_id_show_on_website_idx"
  ON "academic"."staff_profiles"("tenant_id", "show_on_website");

CREATE TABLE IF NOT EXISTS "academic"."website_department_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'ARTS',
  "tagline" TEXT NOT NULL DEFAULT '',
  "about_text" TEXT NOT NULL DEFAULT '',
  "about_html" TEXT NOT NULL DEFAULT '',
  "banner_url" TEXT,
  "gallery_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "office_location" TEXT,
  "established_year" INTEGER,
  "show_on_website" BOOLEAN NOT NULL DEFAULT false,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "featured_faculty_ids" JSONB,
  "downloads_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "hod_message" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "website_department_profiles_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "core"."departments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_department_profiles_department_id_key"
  ON "academic"."website_department_profiles"("department_id");

CREATE UNIQUE INDEX IF NOT EXISTS "website_department_profiles_tenant_id_slug_key"
  ON "academic"."website_department_profiles"("tenant_id", "slug");

CREATE INDEX IF NOT EXISTS "website_department_profiles_tenant_id_show_on_website_idx"
  ON "academic"."website_department_profiles"("tenant_id", "show_on_website");

CREATE INDEX IF NOT EXISTS "website_department_profiles_tenant_id_category_idx"
  ON "academic"."website_department_profiles"("tenant_id", "category");
