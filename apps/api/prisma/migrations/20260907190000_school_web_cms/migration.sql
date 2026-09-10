-- St. Luke's school website CMS tables (schema school). Not college academic.website_*.

CREATE TABLE IF NOT EXISTS "school"."school_web_sites" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "display_name" TEXT NOT NULL,
  "short_name" TEXT NOT NULL,
  "motto" TEXT NOT NULL,
  "address_line" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "pin" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "primary_color" TEXT NOT NULL DEFAULT '#1a365d',
  "accent_color" TEXT NOT NULL DEFAULT '#c5a572',
  "seo_title" TEXT,
  "seo_description" TEXT,
  "apply_cta_url" TEXT,
  "student_portal_url" TEXT,
  "extras_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_sites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_web_sites_tenant_id_key" ON "school"."school_web_sites"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_web_menus" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "location" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_menus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_web_menus_tenant_id_location_key" ON "school"."school_web_menus"("tenant_id", "location");

CREATE TABLE IF NOT EXISTS "school"."school_web_menu_items" (
  "id" UUID NOT NULL,
  "menu_id" UUID NOT NULL,
  "parent_id" UUID,
  "label" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "school_web_menu_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_menu_items_menu_id_sort_order_idx" ON "school"."school_web_menu_items"("menu_id", "sort_order");
ALTER TABLE "school"."school_web_menu_items"
  DROP CONSTRAINT IF EXISTS "school_web_menu_items_menu_id_fkey";
ALTER TABLE "school"."school_web_menu_items"
  ADD CONSTRAINT "school_web_menu_items_menu_id_fkey"
  FOREIGN KEY ("menu_id") REFERENCES "school"."school_web_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_web_menu_items"
  DROP CONSTRAINT IF EXISTS "school_web_menu_items_parent_id_fkey";
ALTER TABLE "school"."school_web_menu_items"
  ADD CONSTRAINT "school_web_menu_items_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "school"."school_web_menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_pages" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduled_at" TIMESTAMPTZ,
  "published_at" TIMESTAMPTZ,
  "seo_title" TEXT,
  "seo_description" TEXT,
  "block_document" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_pages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_web_pages_tenant_id_slug_key" ON "school"."school_web_pages"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "school_web_pages_tenant_id_status_idx" ON "school"."school_web_pages"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_web_page_revisions" (
  "id" UUID NOT NULL,
  "page_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_page_revisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_page_revisions_page_id_created_at_idx" ON "school"."school_web_page_revisions"("page_id", "created_at");
ALTER TABLE "school"."school_web_page_revisions"
  DROP CONSTRAINT IF EXISTS "school_web_page_revisions_page_id_fkey";
ALTER TABLE "school"."school_web_page_revisions"
  ADD CONSTRAINT "school_web_page_revisions_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "school"."school_web_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_homepage_sections" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_homepage_sections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_web_homepage_sections_tenant_id_key_key" ON "school"."school_web_homepage_sections"("tenant_id", "key");
CREATE INDEX IF NOT EXISTS "school_web_homepage_sections_tenant_id_sort_order_idx" ON "school"."school_web_homepage_sections"("tenant_id", "sort_order");

CREATE TABLE IF NOT EXISTS "school"."school_web_media_folders" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "parent_id" UUID,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_media_folders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_media_folders_tenant_id_parent_id_idx" ON "school"."school_web_media_folders"("tenant_id", "parent_id");
ALTER TABLE "school"."school_web_media_folders"
  DROP CONSTRAINT IF EXISTS "school_web_media_folders_parent_id_fkey";
ALTER TABLE "school"."school_web_media_folders"
  ADD CONSTRAINT "school_web_media_folders_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "school"."school_web_media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_media_assets" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "folder_id" UUID,
  "file_name" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL DEFAULT 0,
  "alt" TEXT,
  "variants" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_media_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_media_assets_tenant_id_created_at_idx" ON "school"."school_web_media_assets"("tenant_id", "created_at");
ALTER TABLE "school"."school_web_media_assets"
  DROP CONSTRAINT IF EXISTS "school_web_media_assets_folder_id_fkey";
ALTER TABLE "school"."school_web_media_assets"
  ADD CONSTRAINT "school_web_media_assets_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "school"."school_web_media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_notices" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "body" TEXT NOT NULL,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "pdf_asset_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_notices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_web_notices_tenant_id_slug_key" ON "school"."school_web_notices"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "school_web_notices_tenant_id_status_published_at_idx" ON "school"."school_web_notices"("tenant_id", "status", "published_at");
ALTER TABLE "school"."school_web_notices"
  DROP CONSTRAINT IF EXISTS "school_web_notices_pdf_asset_id_fkey";
ALTER TABLE "school"."school_web_notices"
  ADD CONSTRAINT "school_web_notices_pdf_asset_id_fkey"
  FOREIGN KEY ("pdf_asset_id") REFERENCES "school"."school_web_media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "venue" TEXT,
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "image_asset_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_web_events_tenant_id_slug_key" ON "school"."school_web_events"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "school_web_events_tenant_id_starts_at_idx" ON "school"."school_web_events"("tenant_id", "starts_at");
ALTER TABLE "school"."school_web_events"
  DROP CONSTRAINT IF EXISTS "school_web_events_image_asset_id_fkey";
ALTER TABLE "school"."school_web_events"
  ADD CONSTRAINT "school_web_events_image_asset_id_fkey"
  FOREIGN KEY ("image_asset_id") REFERENCES "school"."school_web_media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_gallery_albums" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_gallery_albums_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_web_gallery_albums_tenant_id_slug_key" ON "school"."school_web_gallery_albums"("tenant_id", "slug");

CREATE TABLE IF NOT EXISTS "school"."school_web_gallery_items" (
  "id" UUID NOT NULL,
  "album_id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "caption" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "school_web_gallery_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_gallery_items_album_id_sort_order_idx" ON "school"."school_web_gallery_items"("album_id", "sort_order");
ALTER TABLE "school"."school_web_gallery_items"
  DROP CONSTRAINT IF EXISTS "school_web_gallery_items_album_id_fkey";
ALTER TABLE "school"."school_web_gallery_items"
  ADD CONSTRAINT "school_web_gallery_items_album_id_fkey"
  FOREIGN KEY ("album_id") REFERENCES "school"."school_web_gallery_albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_web_gallery_items"
  DROP CONSTRAINT IF EXISTS "school_web_gallery_items_asset_id_fkey";
ALTER TABLE "school"."school_web_gallery_items"
  ADD CONSTRAINT "school_web_gallery_items_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "school"."school_web_media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_downloads" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "asset_id" UUID,
  "published_at" TIMESTAMPTZ,
  "download_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_downloads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_downloads_tenant_id_status_idx" ON "school"."school_web_downloads"("tenant_id", "status");
ALTER TABLE "school"."school_web_downloads"
  DROP CONSTRAINT IF EXISTS "school_web_downloads_asset_id_fkey";
ALTER TABLE "school"."school_web_downloads"
  ADD CONSTRAINT "school_web_downloads_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "school"."school_web_media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_enquiries" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_enquiries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_enquiries_tenant_id_status_created_at_idx" ON "school"."school_web_enquiries"("tenant_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_web_staff_profiles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "school_staff_id" UUID,
  "full_name" TEXT NOT NULL,
  "designation" TEXT,
  "bio" TEXT,
  "photo_asset_id" UUID,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_staff_profiles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_staff_profiles_tenant_id_published_sort_order_idx"
  ON "school"."school_web_staff_profiles"("tenant_id", "published", "sort_order");
ALTER TABLE "school"."school_web_staff_profiles"
  DROP CONSTRAINT IF EXISTS "school_web_staff_profiles_school_staff_id_fkey";
ALTER TABLE "school"."school_web_staff_profiles"
  ADD CONSTRAINT "school_web_staff_profiles_school_staff_id_fkey"
  FOREIGN KEY ("school_staff_id") REFERENCES "school"."school_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_web_staff_profiles"
  DROP CONSTRAINT IF EXISTS "school_web_staff_profiles_photo_asset_id_fkey";
ALTER TABLE "school"."school_web_staff_profiles"
  ADD CONSTRAINT "school_web_staff_profiles_photo_asset_id_fkey"
  FOREIGN KEY ("photo_asset_id") REFERENCES "school"."school_web_media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_web_audit_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT,
  "before_json" JSONB,
  "after_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_web_audit_logs_tenant_id_created_at_idx"
  ON "school"."school_web_audit_logs"("tenant_id", "created_at");
