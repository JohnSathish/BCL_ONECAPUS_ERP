-- Communication Hub (Sprint 1)

CREATE TABLE "platform"."communication_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "subject" TEXT,
    "body_html" TEXT,
    "body_text" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "channels" JSONB NOT NULL DEFAULT '["EMAIL","IN_APP"]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."communication_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT,
    "body_text" TEXT,
    "audience_type" TEXT NOT NULL,
    "audience_filter" JSONB NOT NULL DEFAULT '{}',
    "channels" JSONB NOT NULL DEFAULT '["IN_APP","EMAIL"]',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."communication_recipients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "user_id" UUID,
    "student_id" UUID,
    "staff_profile_id" UUID,
    "display_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "delivery_status" TEXT NOT NULL DEFAULT 'PENDING',
    "read_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."communication_delivery_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID,
    "recipient_id" UUID,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_ref" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "campaign_id" UUID,
    "read_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."notification_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_templates_tenant_id_code_key" ON "platform"."communication_templates"("tenant_id", "code");
CREATE INDEX "communication_templates_tenant_id_category_idx" ON "platform"."communication_templates"("tenant_id", "category");

CREATE INDEX "communication_campaigns_tenant_id_status_idx" ON "platform"."communication_campaigns"("tenant_id", "status");
CREATE INDEX "communication_campaigns_tenant_id_scheduled_at_idx" ON "platform"."communication_campaigns"("tenant_id", "scheduled_at");

CREATE INDEX "communication_recipients_tenant_id_campaign_id_idx" ON "platform"."communication_recipients"("tenant_id", "campaign_id");
CREATE INDEX "communication_recipients_tenant_id_user_id_idx" ON "platform"."communication_recipients"("tenant_id", "user_id");

CREATE INDEX "communication_delivery_logs_tenant_id_campaign_id_idx" ON "platform"."communication_delivery_logs"("tenant_id", "campaign_id");
CREATE INDEX "communication_delivery_logs_tenant_id_channel_status_idx" ON "platform"."communication_delivery_logs"("tenant_id", "channel", "status");

CREATE INDEX "notifications_tenant_id_user_id_read_at_idx" ON "platform"."notifications"("tenant_id", "user_id", "read_at");
CREATE INDEX "notifications_tenant_id_user_id_created_at_idx" ON "platform"."notifications"("tenant_id", "user_id", "created_at");

CREATE UNIQUE INDEX "notification_preferences_tenant_id_user_id_channel_key" ON "platform"."notification_preferences"("tenant_id", "user_id", "channel");

ALTER TABLE "platform"."communication_templates" ADD CONSTRAINT "communication_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform"."communication_campaigns" ADD CONSTRAINT "communication_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "platform"."communication_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform"."communication_campaigns" ADD CONSTRAINT "communication_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform"."communication_recipients" ADD CONSTRAINT "communication_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "platform"."communication_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform"."communication_recipients" ADD CONSTRAINT "communication_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform"."communication_delivery_logs" ADD CONSTRAINT "communication_delivery_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "platform"."communication_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform"."communication_delivery_logs" ADD CONSTRAINT "communication_delivery_logs_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "platform"."communication_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform"."notifications" ADD CONSTRAINT "notifications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "platform"."communication_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
