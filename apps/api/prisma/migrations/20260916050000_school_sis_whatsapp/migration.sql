-- School SIS WhatsApp Business (Meta Cloud API). Isolated school schema.

CREATE TABLE "school"."school_whatsapp_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "default_language" TEXT NOT NULL DEFAULT 'en',
    "default_phone_number_id" UUID,
    "retry_attempts" INTEGER NOT NULL DEFAULT 3,
    "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 80,
    "require_campaign_confirm" BOOLEAN NOT NULL DEFAULT true,
    "allow_duplicate_send" BOOLEAN NOT NULL DEFAULT false,
    "campaign_approval" BOOLEAN NOT NULL DEFAULT false,
    "opt_in_required" BOOLEAN NOT NULL DEFAULT true,
    "essential_categories" JSONB NOT NULL DEFAULT '["ACADEMIC","FEES","ATTENDANCE","TRANSPORT","EMERGENCY"]',
    "graph_api_version" TEXT NOT NULL DEFAULT 'v22.0',
    "embedded_signup_version" TEXT NOT NULL DEFAULT 'v4',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_whatsapp_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_settings_tenant_id_key" ON "school"."school_whatsapp_settings"("tenant_id");

CREATE TABLE "school"."school_whatsapp_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'META',
    "waba_id" TEXT,
    "business_portfolio_id" TEXT,
    "app_id" TEXT,
    "api_version" TEXT NOT NULL DEFAULT 'v22.0',
    "access_token_enc" TEXT,
    "app_secret_enc" TEXT,
    "webhook_verify_enc" TEXT,
    "webhook_verify_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "last_health_at" TIMESTAMP(3),
    "last_webhook_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_whatsapp_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_whatsapp_accounts_tenant_id_status_idx" ON "school"."school_whatsapp_accounts"("tenant_id", "status");

CREATE TABLE "school"."school_whatsapp_phone_numbers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "display_phone" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "quality_rating" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'GENERAL',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_whatsapp_phone_numbers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_phone_numbers_tenant_id_phone_number_id_key" ON "school"."school_whatsapp_phone_numbers"("tenant_id", "phone_number_id");
CREATE INDEX "school_whatsapp_phone_numbers_tenant_id_is_default_status_idx" ON "school"."school_whatsapp_phone_numbers"("tenant_id", "is_default", "status");

CREATE TABLE "school"."school_whatsapp_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "student_id" UUID,
    "guardian_id" UUID,
    "staff_id" UUID,
    "relationship" TEXT,
    "last_inbound_at" TIMESTAMP(3),
    "last_outbound_at" TIMESTAMP(3),
    "window_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_whatsapp_contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_contacts_tenant_id_phone_e164_key" ON "school"."school_whatsapp_contacts"("tenant_id", "phone_e164");
CREATE INDEX "school_whatsapp_contacts_tenant_id_student_id_idx" ON "school"."school_whatsapp_contacts"("tenant_id", "student_id");
CREATE INDEX "school_whatsapp_contacts_tenant_id_guardian_id_idx" ON "school"."school_whatsapp_contacts"("tenant_id", "guardian_id");
CREATE INDEX "school_whatsapp_contacts_tenant_id_staff_id_idx" ON "school"."school_whatsapp_contacts"("tenant_id", "staff_id");

CREATE TABLE "school"."school_whatsapp_opt_ins" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "source" TEXT NOT NULL DEFAULT 'OFFICE',
    "consented_at" TIMESTAMP(3),
    "opted_out_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_whatsapp_opt_ins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_opt_ins_contact_id_category_key" ON "school"."school_whatsapp_opt_ins"("contact_id", "category");
CREATE INDEX "school_whatsapp_opt_ins_tenant_id_status_category_idx" ON "school"."school_whatsapp_opt_ins"("tenant_id", "status", "category");

CREATE TABLE "school"."school_whatsapp_conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "phone_number_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigned_to" UUID,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3),
    "last_preview" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_whatsapp_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_conversations_tenant_id_contact_id_phone_number_id_key" ON "school"."school_whatsapp_conversations"("tenant_id", "contact_id", "phone_number_id");
CREATE INDEX "school_whatsapp_conversations_tenant_id_status_last_message_at_idx" ON "school"."school_whatsapp_conversations"("tenant_id", "status", "last_message_at");
CREATE INDEX "school_whatsapp_conversations_tenant_id_assigned_to_idx" ON "school"."school_whatsapp_conversations"("tenant_id", "assigned_to");

CREATE TABLE "school"."school_whatsapp_conversation_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_whatsapp_conversation_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_whatsapp_conversation_notes_tenant_id_conversation_id_created_at_idx" ON "school"."school_whatsapp_conversation_notes"("tenant_id", "conversation_id", "created_at");

CREATE TABLE "school"."school_whatsapp_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL DEFAULT 'UTILITY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "meta_template_id" TEXT,
    "meta_status" TEXT,
    "body" TEXT NOT NULL,
    "header_type" TEXT,
    "header_text" TEXT,
    "footer_text" TEXT,
    "buttons_json" JSONB NOT NULL DEFAULT '[]',
    "components_json" JSONB NOT NULL DEFAULT '[]',
    "library_key" TEXT,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_whatsapp_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_templates_tenant_id_name_language_key" ON "school"."school_whatsapp_templates"("tenant_id", "name", "language");
CREATE INDEX "school_whatsapp_templates_tenant_id_status_category_idx" ON "school"."school_whatsapp_templates"("tenant_id", "status", "category");

CREATE TABLE "school"."school_whatsapp_template_variables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "erp_field" TEXT NOT NULL,
    "sample" TEXT,
    CONSTRAINT "school_whatsapp_template_variables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_template_variables_template_id_position_key" ON "school"."school_whatsapp_template_variables"("template_id", "position");

CREATE TABLE "school"."school_whatsapp_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "template_id" UUID,
    "phone_number_id" UUID,
    "audience_json" JSONB NOT NULL DEFAULT '{}',
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    CONSTRAINT "school_whatsapp_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_whatsapp_campaigns_tenant_id_status_created_at_idx" ON "school"."school_whatsapp_campaigns"("tenant_id", "status", "created_at");

CREATE TABLE "school"."school_whatsapp_campaign_recipients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "contact_id" UUID,
    "phone_e164" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "student_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "skip_reason" TEXT,
    "message_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_whatsapp_campaign_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_campaign_recipients_idempotency_key_key" ON "school"."school_whatsapp_campaign_recipients"("idempotency_key");
CREATE UNIQUE INDEX "school_whatsapp_campaign_recipients_campaign_id_phone_e164_key" ON "school"."school_whatsapp_campaign_recipients"("campaign_id", "phone_e164");
CREATE INDEX "school_whatsapp_campaign_recipients_tenant_id_campaign_id_status_idx" ON "school"."school_whatsapp_campaign_recipients"("tenant_id", "campaign_id", "status");

CREATE TABLE "school"."school_whatsapp_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID,
    "contact_id" UUID NOT NULL,
    "phone_number_id" UUID,
    "campaign_id" UUID,
    "template_id" UUID,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "failure_code" TEXT,
    "failure_reason" TEXT,
    "provider_message_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "sent_by" UUID,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_whatsapp_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_messages_idempotency_key_key" ON "school"."school_whatsapp_messages"("idempotency_key");
CREATE INDEX "school_whatsapp_messages_tenant_id_status_created_at_idx" ON "school"."school_whatsapp_messages"("tenant_id", "status", "created_at");
CREATE INDEX "school_whatsapp_messages_tenant_id_contact_id_created_at_idx" ON "school"."school_whatsapp_messages"("tenant_id", "contact_id", "created_at");
CREATE INDEX "school_whatsapp_messages_tenant_id_provider_message_id_idx" ON "school"."school_whatsapp_messages"("tenant_id", "provider_message_id");
CREATE INDEX "school_whatsapp_messages_tenant_id_sent_by_created_at_idx" ON "school"."school_whatsapp_messages"("tenant_id", "sent_by", "created_at");
CREATE INDEX "school_whatsapp_messages_tenant_id_campaign_id_idx" ON "school"."school_whatsapp_messages"("tenant_id", "campaign_id");

CREATE TABLE "school"."school_whatsapp_message_statuses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_json" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "school_whatsapp_message_statuses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_message_statuses_message_id_status_key" ON "school"."school_whatsapp_message_statuses"("message_id", "status");
CREATE INDEX "school_whatsapp_message_statuses_tenant_id_timestamp_idx" ON "school"."school_whatsapp_message_statuses"("tenant_id", "timestamp");

CREATE TABLE "school"."school_whatsapp_media" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "provider_media_id" TEXT,
    "sha256" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_whatsapp_media_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_whatsapp_media_tenant_id_sha256_idx" ON "school"."school_whatsapp_media"("tenant_id", "sha256");

CREATE TABLE "school"."school_whatsapp_flows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "meta_flow_id" TEXT,
    "schema_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_whatsapp_flows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_whatsapp_flows_tenant_id_kind_status_idx" ON "school"."school_whatsapp_flows"("tenant_id", "kind", "status");

CREATE TABLE "school"."school_whatsapp_automations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "match_value" TEXT,
    "action" TEXT NOT NULL,
    "template_id" UUID,
    "reply_text" TEXT,
    "escalate_to" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_whatsapp_automations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_whatsapp_automations_tenant_id_trigger_active_idx" ON "school"."school_whatsapp_automations"("tenant_id", "trigger", "active");

CREATE TABLE "school"."school_whatsapp_webhook_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "phone_number_id" TEXT,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_whatsapp_webhook_events_event_id_key" ON "school"."school_whatsapp_webhook_events"("event_id");
CREATE INDEX "school_whatsapp_webhook_events_tenant_id_created_at_idx" ON "school"."school_whatsapp_webhook_events"("tenant_id", "created_at");
CREATE INDEX "school_whatsapp_webhook_events_event_type_created_at_idx" ON "school"."school_whatsapp_webhook_events"("event_type", "created_at");

CREATE TABLE "school"."school_whatsapp_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "recipient" TEXT,
    "template" TEXT,
    "message_id" TEXT,
    "ip" TEXT,
    "status" TEXT,
    "detail_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_whatsapp_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_whatsapp_audit_logs_tenant_id_created_at_idx" ON "school"."school_whatsapp_audit_logs"("tenant_id", "created_at");
CREATE INDEX "school_whatsapp_audit_logs_tenant_id_user_id_created_at_idx" ON "school"."school_whatsapp_audit_logs"("tenant_id", "user_id", "created_at");

ALTER TABLE "school"."school_whatsapp_phone_numbers" ADD CONSTRAINT "school_whatsapp_phone_numbers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "school"."school_whatsapp_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_contacts" ADD CONSTRAINT "school_whatsapp_contacts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_contacts" ADD CONSTRAINT "school_whatsapp_contacts_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "school"."school_guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_contacts" ADD CONSTRAINT "school_whatsapp_contacts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_opt_ins" ADD CONSTRAINT "school_whatsapp_opt_ins_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "school"."school_whatsapp_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_conversations" ADD CONSTRAINT "school_whatsapp_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "school"."school_whatsapp_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_conversations" ADD CONSTRAINT "school_whatsapp_conversations_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "school"."school_whatsapp_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_conversation_notes" ADD CONSTRAINT "school_whatsapp_conversation_notes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "school"."school_whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_template_variables" ADD CONSTRAINT "school_whatsapp_template_variables_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "school"."school_whatsapp_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_campaigns" ADD CONSTRAINT "school_whatsapp_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "school"."school_whatsapp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_campaigns" ADD CONSTRAINT "school_whatsapp_campaigns_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "school"."school_whatsapp_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_campaign_recipients" ADD CONSTRAINT "school_whatsapp_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "school"."school_whatsapp_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_campaign_recipients" ADD CONSTRAINT "school_whatsapp_campaign_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "school"."school_whatsapp_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_messages" ADD CONSTRAINT "school_whatsapp_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "school"."school_whatsapp_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_messages" ADD CONSTRAINT "school_whatsapp_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "school"."school_whatsapp_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_messages" ADD CONSTRAINT "school_whatsapp_messages_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "school"."school_whatsapp_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_messages" ADD CONSTRAINT "school_whatsapp_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "school"."school_whatsapp_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_messages" ADD CONSTRAINT "school_whatsapp_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "school"."school_whatsapp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_whatsapp_message_statuses" ADD CONSTRAINT "school_whatsapp_message_statuses_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "school"."school_whatsapp_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
