-- Website CMS home-page popups (schedule on server; frequency/close on client)
CREATE TABLE IF NOT EXISTS "academic"."website_popups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "popup_type" TEXT NOT NULL DEFAULT 'HTML',
  "content_html" TEXT NOT NULL DEFAULT '',
  "content_json" JSONB NOT NULL DEFAULT '{}',
  "image_json" JSONB,
  "video_url" TEXT,
  "video_type" TEXT,
  "button_json" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'INACTIVE',
  "display_order" INT NOT NULL DEFAULT 0,
  "show_trigger" TEXT NOT NULL DEFAULT 'IMMEDIATE',
  "show_delay" INT NOT NULL DEFAULT 0,
  "scroll_percent" INT,
  "frequency" TEXT NOT NULL DEFAULT 'EVERY_VISIT',
  "close_behavior" JSONB NOT NULL DEFAULT '[]',
  "auto_close_seconds" INT,
  "position" TEXT NOT NULL DEFAULT 'CENTER',
  "animation" TEXT NOT NULL DEFAULT 'FADE',
  "overlay_json" JSONB NOT NULL DEFAULT '{}',
  "size_json" JSONB NOT NULL DEFAULT '{}',
  "audience_json" JSONB NOT NULL DEFAULT '{}',
  "start_date" DATE,
  "end_date" DATE,
  "start_time" TEXT,
  "end_time" TEXT,
  "page" TEXT NOT NULL DEFAULT 'HOME',
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "website_popups_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "website_popups_tenant_site_status_page_idx"
  ON "academic"."website_popups" ("tenant_id", "site_id", "status", "page", "display_order");

CREATE INDEX IF NOT EXISTS "website_popups_site_page_schedule_idx"
  ON "academic"."website_popups" ("site_id", "page", "status", "start_date", "end_date");
