-- Multi-tenant public website CMS foundation.

CREATE TABLE "academic"."website_sites" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "primary_domain" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "website_sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_pages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "current_revision_id" UUID,
    "published_revision_id" UUID,
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_page_revisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body_html" TEXT NOT NULL DEFAULT '',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "seo_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "change_note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_page_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_media_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'IMAGE',
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "alt_text" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_redirects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "website_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "website_sites_tenant_id_key" ON "academic"."website_sites"("tenant_id");
CREATE UNIQUE INDEX "website_sites_tenant_id_slug_key" ON "academic"."website_sites"("tenant_id", "slug");
CREATE INDEX "website_sites_tenant_id_status_idx" ON "academic"."website_sites"("tenant_id", "status");
CREATE UNIQUE INDEX "website_pages_current_revision_id_key" ON "academic"."website_pages"("current_revision_id");
CREATE UNIQUE INDEX "website_pages_published_revision_id_key" ON "academic"."website_pages"("published_revision_id");
CREATE UNIQUE INDEX "website_pages_site_id_path_key" ON "academic"."website_pages"("site_id", "path");
CREATE INDEX "website_pages_tenant_id_site_id_status_idx" ON "academic"."website_pages"("tenant_id", "site_id", "status");
CREATE INDEX "website_pages_site_id_published_at_idx" ON "academic"."website_pages"("site_id", "published_at");
CREATE UNIQUE INDEX "website_page_revisions_page_id_revision_number_key" ON "academic"."website_page_revisions"("page_id", "revision_number");
CREATE INDEX "website_page_revisions_tenant_id_page_id_created_at_idx" ON "academic"."website_page_revisions"("tenant_id", "page_id", "created_at");
CREATE UNIQUE INDEX "website_media_assets_site_id_storage_key_key" ON "academic"."website_media_assets"("site_id", "storage_key");
CREATE INDEX "website_media_assets_tenant_id_site_id_kind_idx" ON "academic"."website_media_assets"("tenant_id", "site_id", "kind");
CREATE UNIQUE INDEX "website_redirects_site_id_from_path_key" ON "academic"."website_redirects"("site_id", "from_path");
CREATE INDEX "website_redirects_tenant_id_site_id_is_active_idx" ON "academic"."website_redirects"("tenant_id", "site_id", "is_active");

ALTER TABLE "academic"."website_pages" ADD CONSTRAINT "website_pages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_page_revisions" ADD CONSTRAINT "website_page_revisions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "academic"."website_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_pages" ADD CONSTRAINT "website_pages_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "academic"."website_page_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."website_pages" ADD CONSTRAINT "website_pages_published_revision_id_fkey" FOREIGN KEY ("published_revision_id") REFERENCES "academic"."website_page_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."website_media_assets" ADD CONSTRAINT "website_media_assets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_redirects" ADD CONSTRAINT "website_redirects_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."website_pages"
  ADD COLUMN "template" TEXT NOT NULL DEFAULT 'DEFAULT',
  ADD COLUMN "scheduled_at" TIMESTAMP(3),
  ADD COLUMN "published_sections" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "academic"."website_media_assets"
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "academic"."website_page_sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "heading" TEXT,
    "body_html" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "website_page_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_menus" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "website_menus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_menu_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '_self',
    "position" INTEGER NOT NULL DEFAULT 0,
    "parent_id" UUID,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "website_menu_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_content_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "website_content_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_content_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "content_type_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "data" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "website_content_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_preview_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "page_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    CONSTRAINT "website_preview_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."website_revisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actor_id" UUID,
    "actor_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "website_page_sections_tenant_id_page_id_position_idx" ON "academic"."website_page_sections"("tenant_id", "page_id", "position");
CREATE UNIQUE INDEX "website_menus_site_id_location_key" ON "academic"."website_menus"("site_id", "location");
CREATE INDEX "website_menus_tenant_id_site_id_idx" ON "academic"."website_menus"("tenant_id", "site_id");
CREATE INDEX "website_menu_items_tenant_id_menu_id_position_idx" ON "academic"."website_menu_items"("tenant_id", "menu_id", "position");
CREATE INDEX "website_menu_items_parent_id_idx" ON "academic"."website_menu_items"("parent_id");
CREATE UNIQUE INDEX "website_content_types_site_id_slug_key" ON "academic"."website_content_types"("site_id", "slug");
CREATE INDEX "website_content_types_tenant_id_site_id_idx" ON "academic"."website_content_types"("tenant_id", "site_id");
CREATE UNIQUE INDEX "website_content_entries_content_type_id_slug_key" ON "academic"."website_content_entries"("content_type_id", "slug");
CREATE INDEX "website_content_entries_tenant_id_site_id_status_idx" ON "academic"."website_content_entries"("tenant_id", "site_id", "status");
CREATE INDEX "website_content_entries_scheduled_at_status_idx" ON "academic"."website_content_entries"("scheduled_at", "status");
CREATE UNIQUE INDEX "website_preview_tokens_token_hash_key" ON "academic"."website_preview_tokens"("token_hash");
CREATE INDEX "website_preview_tokens_tenant_id_expires_at_idx" ON "academic"."website_preview_tokens"("tenant_id", "expires_at");
CREATE UNIQUE INDEX "website_revisions_entity_type_entity_id_version_key" ON "academic"."website_revisions"("entity_type", "entity_id", "version");
CREATE INDEX "website_revisions_tenant_id_site_id_created_at_idx" ON "academic"."website_revisions"("tenant_id", "site_id", "created_at");

ALTER TABLE "academic"."website_page_sections" ADD CONSTRAINT "website_page_sections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "academic"."website_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_menus" ADD CONSTRAINT "website_menus_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_menu_items" ADD CONSTRAINT "website_menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "academic"."website_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_menu_items" ADD CONSTRAINT "website_menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "academic"."website_menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."website_content_types" ADD CONSTRAINT "website_content_types_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_content_entries" ADD CONSTRAINT "website_content_entries_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_content_entries" ADD CONSTRAINT "website_content_entries_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "academic"."website_content_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_preview_tokens" ADD CONSTRAINT "website_preview_tokens_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_preview_tokens" ADD CONSTRAINT "website_preview_tokens_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "academic"."website_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."website_revisions" ADD CONSTRAINT "website_revisions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
