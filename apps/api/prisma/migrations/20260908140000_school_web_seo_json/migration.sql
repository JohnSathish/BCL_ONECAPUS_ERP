-- CMS-controlled SEO documents for St. Luke's public website pages, notices and events.

ALTER TABLE "school"."school_web_pages"
  ADD COLUMN IF NOT EXISTS "seo_json" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "school"."school_web_notices"
  ADD COLUMN IF NOT EXISTS "seo_json" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "school"."school_web_events"
  ADD COLUMN IF NOT EXISTS "seo_json" JSONB NOT NULL DEFAULT '{}'::jsonb;
