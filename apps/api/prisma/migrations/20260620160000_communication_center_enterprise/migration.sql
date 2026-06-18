-- Communication Center Enterprise extensions

ALTER TABLE "platform"."communication_delivery_logs"
  ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "clicked_at" TIMESTAMPTZ;

ALTER TABLE "platform"."notifications"
  ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ;

ALTER TABLE "platform"."communication_campaigns"
  ADD COLUMN IF NOT EXISTS "approval_status" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "requires_approval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "platform"."communication_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "default_sender_name" TEXT,
  "reply_email" TEXT,
  "sms_sender_id" TEXT,
  "whatsapp_business_number" TEXT,
  "notification_logo_url" TEXT,
  "footer_template" TEXT,
  "smtp_config" JSONB NOT NULL DEFAULT '{}',
  "sms_config" JSONB NOT NULL DEFAULT '{}',
  "whatsapp_config" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "communication_settings_tenant_id_key"
  ON "platform"."communication_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "platform"."communication_approvals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "campaign_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_HOD',
  "submitted_by_id" UUID,
  "current_approver_role" TEXT,
  "history" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "communication_approvals_tenant_campaign_idx"
  ON "platform"."communication_approvals"("tenant_id", "campaign_id");

CREATE TABLE IF NOT EXISTS "platform"."communication_whatsapp_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'UTILITY',
  "meta_template_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "language" TEXT NOT NULL DEFAULT 'en',
  "body" TEXT NOT NULL,
  "variables" JSONB NOT NULL DEFAULT '[]',
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_whatsapp_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "communication_whatsapp_templates_tenant_idx"
  ON "platform"."communication_whatsapp_templates"("tenant_id");

CREATE TABLE IF NOT EXISTS "platform"."communication_automation_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "schedule" TEXT,
  "channels" JSONB NOT NULL DEFAULT '["EMAIL","IN_APP"]',
  "template_code" TEXT,
  "config" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "communication_automation_rules_tenant_code_key"
  ON "platform"."communication_automation_rules"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "platform"."communication_audience_segments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "audience_type" TEXT NOT NULL,
  "filters" JSONB NOT NULL DEFAULT '{}',
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_audience_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "communication_audience_segments_tenant_idx"
  ON "platform"."communication_audience_segments"("tenant_id");
