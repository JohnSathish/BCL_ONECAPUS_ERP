-- Website newsletter subscribers (footer subscribe form)
CREATE TABLE IF NOT EXISTS "academic"."website_newsletter_subscribers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "source" TEXT NOT NULL DEFAULT 'FOOTER',
  "unsubscribed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "website_newsletter_subscribers_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "website_newsletter_subscribers_site_id_email_key" UNIQUE ("site_id", "email")
);

CREATE INDEX IF NOT EXISTS "website_newsletter_subscribers_tenant_site_created_idx"
  ON "academic"."website_newsletter_subscribers" ("tenant_id", "site_id", "created_at");

CREATE INDEX IF NOT EXISTS "website_newsletter_subscribers_site_status_idx"
  ON "academic"."website_newsletter_subscribers" ("site_id", "status");
