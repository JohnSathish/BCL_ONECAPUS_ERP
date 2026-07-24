-- Website CMS announcements (featured image, PDF, pin, expiry, publish)
CREATE TABLE IF NOT EXISTS "academic"."website_announcements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "body_html" TEXT NOT NULL DEFAULT '',
  "featured_image_url" TEXT,
  "featured_image_alt" TEXT,
  "attachment_url" TEXT,
  "attachment_name" TEXT,
  "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  "show_on_ticker" BOOLEAN NOT NULL DEFAULT true,
  "show_on_homepage" BOOLEAN NOT NULL DEFAULT true,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "publish_at" TIMESTAMPTZ,
  "expire_at" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "deleted_at" TIMESTAMPTZ,
  "deleted_by_id" UUID,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "website_announcements_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "website_announcements_site_id_slug_key" UNIQUE ("site_id", "slug")
);

CREATE INDEX IF NOT EXISTS "website_announcements_tenant_site_status_idx"
  ON "academic"."website_announcements" ("tenant_id", "site_id", "status", "deleted_at", "publish_at");
CREATE INDEX IF NOT EXISTS "website_announcements_site_pinned_idx"
  ON "academic"."website_announcements" ("site_id", "is_pinned", "publish_at");
CREATE INDEX IF NOT EXISTS "website_announcements_site_ticker_idx"
  ON "academic"."website_announcements" ("site_id", "show_on_ticker", "status", "deleted_at");
