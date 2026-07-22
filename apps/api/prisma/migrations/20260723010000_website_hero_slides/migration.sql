-- Website homepage hero slider slides
CREATE TABLE IF NOT EXISTS academic.website_hero_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES academic.website_sites(id) ON DELETE CASCADE,
  alt_text TEXT NOT NULL DEFAULT '',
  desktop_url TEXT NOT NULL,
  mobile_url TEXT NULL,
  media_id UUID NULL,
  mobile_media_id UUID NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS website_hero_slides_tenant_site_position_idx
  ON academic.website_hero_slides (tenant_id, site_id, position);

CREATE INDEX IF NOT EXISTS website_hero_slides_site_active_position_idx
  ON academic.website_hero_slides (site_id, is_active, position);
