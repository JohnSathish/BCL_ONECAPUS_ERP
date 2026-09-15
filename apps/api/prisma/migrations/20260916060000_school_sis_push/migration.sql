-- School SIS mobile push campaigns (FCM). Isolated school schema.

ALTER TABLE "school"."school_mobile_devices"
  ADD COLUMN IF NOT EXISTS "device_model" TEXT,
  ADD COLUMN IF NOT EXISTS "os_version" TEXT,
  ADD COLUMN IF NOT EXISTS "last_token_refresh_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "school"."school_push_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "default_priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "default_icon_url" TEXT,
    "default_ttl_seconds" INTEGER NOT NULL DEFAULT 86400,
    "queue_enabled" BOOLEAN NOT NULL DEFAULT true,
    "retry_attempts" INTEGER NOT NULL DEFAULT 3,
    "batch_size" INTEGER NOT NULL DEFAULT 80,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_from" TEXT NOT NULL DEFAULT '21:00',
    "quiet_to" TEXT NOT NULL DEFAULT '06:00',
    "digest_enabled" BOOLEAN NOT NULL DEFAULT false,
    "digest_hour" TEXT NOT NULL DEFAULT '18:00',
    "emergency_bypass_quiet" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_push_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_push_settings_tenant_id_key" ON "school"."school_push_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_push_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deep_link_type" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_push_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_push_templates_tenant_id_category_active_idx"
  ON "school"."school_push_templates"("tenant_id", "category", "active");

CREATE TABLE IF NOT EXISTS "school"."school_push_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "image_url" TEXT,
    "icon_url" TEXT,
    "deep_link_type" TEXT,
    "deep_link_value" TEXT,
    "audience_type" TEXT NOT NULL,
    "audience_json" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "device_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_push_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_push_campaigns_tenant_id_status_created_at_idx"
  ON "school"."school_push_campaigns"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "school_push_campaigns_tenant_id_scheduled_at_idx"
  ON "school"."school_push_campaigns"("tenant_id", "scheduled_at");

CREATE TABLE IF NOT EXISTS "school"."school_push_recipients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "student_id" UUID,
    "device_id" UUID,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "failure_code" TEXT,
    "failure_reason" TEXT,
    "provider_ref" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_push_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_push_recipients_idempotency_key_key"
  ON "school"."school_push_recipients"("idempotency_key");
CREATE INDEX IF NOT EXISTS "school_push_recipients_tenant_id_campaign_id_status_idx"
  ON "school"."school_push_recipients"("tenant_id", "campaign_id", "status");
CREATE INDEX IF NOT EXISTS "school_push_recipients_tenant_id_user_id_created_at_idx"
  ON "school"."school_push_recipients"("tenant_id", "user_id", "created_at");

ALTER TABLE "school"."school_push_recipients"
  ADD CONSTRAINT "school_push_recipients_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "school"."school_push_campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_push_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_push_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_push_preferences_tenant_id_user_id_category_key"
  ON "school"."school_push_preferences"("tenant_id", "user_id", "category");

CREATE TABLE IF NOT EXISTS "school"."school_push_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "wa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "digest_only" BOOLEAN NOT NULL DEFAULT false,
    "template_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_push_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_push_rules_tenant_id_event_type_key"
  ON "school"."school_push_rules"("tenant_id", "event_type");

CREATE TABLE IF NOT EXISTS "school"."school_push_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "campaign_id" UUID,
    "detail_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_push_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_push_audit_logs_tenant_id_created_at_idx"
  ON "school"."school_push_audit_logs"("tenant_id", "created_at");
