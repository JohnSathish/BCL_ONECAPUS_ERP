-- White-label product identity (tenant-configurable; not hard-coded in UI)
ALTER TABLE "platform"."tenant_branding"
  ADD COLUMN IF NOT EXISTS "product_name" TEXT,
  ADD COLUMN IF NOT EXISTS "product_tagline" TEXT,
  ADD COLUMN IF NOT EXISTS "powered_by_text" TEXT;

-- Generic platform defaults for existing rows (DBC seed sets Bosco Connect explicitly)
UPDATE "platform"."tenant_branding"
SET
  "product_name" = COALESCE(NULLIF(TRIM("product_name"), ''), 'Campus ERP'),
  "product_tagline" = COALESCE(
    NULLIF(TRIM("product_tagline"), ''),
    'Smart Education Management Platform'
  ),
  "powered_by_text" = COALESCE(
    NULLIF(TRIM("powered_by_text"), ''),
    'Powered by BaseCode Labs'
  )
WHERE
  "product_name" IS NULL
  OR "product_tagline" IS NULL
  OR "powered_by_text" IS NULL;

-- Don Bosco College, Tura (demo tenant) → Bosco Connect
UPDATE "platform"."tenant_branding" AS b
SET
  "product_name" = 'Bosco Connect',
  "product_tagline" = 'Smart Education Management Platform',
  "powered_by_text" = 'Powered by BaseCode Labs'
FROM "platform"."tenants" AS t
WHERE b."tenant_id" = t."id"
  AND t."slug" = 'demo'
  AND t."deleted_at" IS NULL;
