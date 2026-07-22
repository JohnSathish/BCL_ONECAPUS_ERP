-- Enterprise Website CMS foundation (Phase 0+)
-- Soft delete
ALTER TABLE academic.website_pages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_id UUID NULL;

ALTER TABLE academic.website_media_assets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_id UUID NULL,
  ADD COLUMN IF NOT EXISTS folder_id UUID NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE academic.website_content_entries
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_id UUID NULL;

CREATE INDEX IF NOT EXISTS website_pages_deleted_at_idx
  ON academic.website_pages (tenant_id, site_id, deleted_at);
CREATE INDEX IF NOT EXISTS website_media_deleted_at_idx
  ON academic.website_media_assets (tenant_id, site_id, deleted_at);
CREATE INDEX IF NOT EXISTS website_content_entries_deleted_at_idx
  ON academic.website_content_entries (tenant_id, site_id, deleted_at);

-- Media folders
CREATE TABLE IF NOT EXISTS academic.website_media_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES academic.website_sites(id) ON DELETE CASCADE,
  parent_id UUID NULL REFERENCES academic.website_media_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS website_media_folders_site_idx
  ON academic.website_media_folders (tenant_id, site_id, parent_id);

DO $$ BEGIN
  ALTER TABLE academic.website_media_assets
    ADD CONSTRAINT website_media_assets_folder_id_fkey
    FOREIGN KEY (folder_id) REFERENCES academic.website_media_folders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notice Board
CREATE TABLE IF NOT EXISTS academic.website_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES academic.website_sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'GENERAL',
  department_id UUID NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  publish_at TIMESTAMPTZ NULL,
  expire_at TIMESTAMPTZ NULL,
  attachment_url TEXT NULL,
  attachment_name TEXT NULL,
  show_on_homepage BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  deleted_at TIMESTAMPTZ NULL,
  deleted_by_id UUID NULL,
  created_by_id UUID NULL,
  updated_by_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, slug)
);
CREATE INDEX IF NOT EXISTS website_notices_list_idx
  ON academic.website_notices (tenant_id, site_id, status, deleted_at, publish_at);
CREATE INDEX IF NOT EXISTS website_notices_home_idx
  ON academic.website_notices (site_id, show_on_homepage, status, deleted_at);

-- Homepage layout sections
CREATE TABLE IF NOT EXISTS academic.website_homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES academic.website_sites(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  position INT NOT NULL DEFAULT 0,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, section_key)
);
CREATE INDEX IF NOT EXISTS website_homepage_sections_order_idx
  ON academic.website_homepage_sections (tenant_id, site_id, position);

-- Menu item link typing (WordPress-like targets)
ALTER TABLE academic.website_menu_items
  ADD COLUMN IF NOT EXISTS link_type TEXT NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN IF NOT EXISTS link_ref TEXT NULL;

-- Page SEO extras on revisions
ALTER TABLE academic.website_page_revisions
  ADD COLUMN IF NOT EXISTS canonical_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS og_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS robots TEXT NULL;
