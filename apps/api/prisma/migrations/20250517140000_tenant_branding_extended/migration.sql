-- Extended institution branding fields

ALTER TABLE "platform"."tenant_branding"
  ADD COLUMN IF NOT EXISTS "short_name" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "favicon_url" TEXT,
  ADD COLUMN IF NOT EXISTS "sidebar_color" TEXT,
  ADD COLUMN IF NOT EXISTS "login_background_style" TEXT NOT NULL DEFAULT 'gradient',
  ADD COLUMN IF NOT EXISTS "show_powered_by" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "branding_enabled" BOOLEAN NOT NULL DEFAULT true;
