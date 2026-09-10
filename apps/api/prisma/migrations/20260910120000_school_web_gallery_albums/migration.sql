CREATE TABLE IF NOT EXISTS "school"."school_web_gallery_categories" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_gallery_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_web_gallery_categories_tenant_id_slug_key"
  ON "school"."school_web_gallery_categories"("tenant_id", "slug");

CREATE TABLE IF NOT EXISTS "school"."school_web_gallery_tags" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_web_gallery_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_web_gallery_tags_tenant_id_slug_key"
  ON "school"."school_web_gallery_tags"("tenant_id", "slug");

CREATE TABLE IF NOT EXISTS "school"."school_web_gallery_album_tags" (
  "album_id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  CONSTRAINT "school_web_gallery_album_tags_pkey" PRIMARY KEY ("album_id", "tag_id")
);

ALTER TABLE "school"."school_web_gallery_albums"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "category_id" UUID,
  ADD COLUMN IF NOT EXISTS "event_name" TEXT,
  ADD COLUMN IF NOT EXISTS "event_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "cover_asset_id" UUID,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "allow_download" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "seo_json" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "view_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "academic_year" TEXT,
  ADD COLUMN IF NOT EXISTS "created_by" UUID,
  ADD COLUMN IF NOT EXISTS "updated_by" UUID,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

UPDATE "school"."school_web_gallery_albums"
SET "status" = CASE WHEN "published" THEN 'PUBLISHED' ELSE 'DRAFT' END,
    "published_at" = CASE WHEN "published" THEN COALESCE("published_at", "created_at") ELSE "published_at" END;

ALTER TABLE "school"."school_web_gallery_items"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "alt_text" TEXT,
  ADD COLUMN IF NOT EXISTS "credit" TEXT,
  ADD COLUMN IF NOT EXISTS "uploaded_by" UUID,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_web_gallery_albums_category_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_web_gallery_albums"
      ADD CONSTRAINT "school_web_gallery_albums_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "school"."school_web_gallery_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_web_gallery_albums_cover_asset_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_web_gallery_albums"
      ADD CONSTRAINT "school_web_gallery_albums_cover_asset_id_fkey"
      FOREIGN KEY ("cover_asset_id") REFERENCES "school"."school_web_media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_web_gallery_album_tags_album_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_web_gallery_album_tags"
      ADD CONSTRAINT "school_web_gallery_album_tags_album_id_fkey"
      FOREIGN KEY ("album_id") REFERENCES "school"."school_web_gallery_albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_web_gallery_album_tags_tag_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_web_gallery_album_tags"
      ADD CONSTRAINT "school_web_gallery_album_tags_tag_id_fkey"
      FOREIGN KEY ("tag_id") REFERENCES "school"."school_web_gallery_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "school_web_gallery_albums_tenant_status_vis_idx"
  ON "school"."school_web_gallery_albums"("tenant_id", "status", "visibility");
CREATE INDEX IF NOT EXISTS "school_web_gallery_albums_tenant_event_date_idx"
  ON "school"."school_web_gallery_albums"("tenant_id", "event_date");
