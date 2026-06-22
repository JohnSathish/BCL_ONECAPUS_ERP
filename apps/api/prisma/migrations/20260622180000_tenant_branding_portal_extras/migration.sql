-- Careers / admissions portal extras (principal message, hero images, etc.)
ALTER TABLE "platform"."tenant_branding"
ADD COLUMN IF NOT EXISTS "portal_extras_json" JSONB NOT NULL DEFAULT '{}';
