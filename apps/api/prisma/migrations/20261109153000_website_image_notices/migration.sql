CREATE TABLE IF NOT EXISTS academic.website_image_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES academic.website_sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS website_image_notices_tenant_id_site_id_sort_order_idx
  ON academic.website_image_notices (tenant_id, site_id, sort_order);

CREATE INDEX IF NOT EXISTS website_image_notices_site_id_is_visible_sort_order_idx
  ON academic.website_image_notices (site_id, is_visible, sort_order);
