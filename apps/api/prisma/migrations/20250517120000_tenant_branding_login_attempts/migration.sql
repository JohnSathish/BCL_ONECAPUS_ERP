-- Tenant branding and login attempt tracking for institution-branded login

CREATE TABLE "platform"."tenant_branding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "campus_name" TEXT,
    "portal_subtitle" TEXT,
    "logo_url" TEXT,
    "primary_color" TEXT,
    "accent_color" TEXT,
    "badges" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_branding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_branding_tenant_id_key" ON "platform"."tenant_branding"("tenant_id");

ALTER TABLE "platform"."tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform"."login_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ip_address" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "login_attempts_tenant_id_ip_address_email_key" ON "platform"."login_attempts"("tenant_id", "ip_address", "email");

CREATE INDEX "login_attempts_tenant_id_ip_address_idx" ON "platform"."login_attempts"("tenant_id", "ip_address");

ALTER TABLE "platform"."login_attempts" ADD CONSTRAINT "login_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
