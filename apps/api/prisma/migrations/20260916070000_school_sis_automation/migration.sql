-- School SIS automation engine. Isolated school schema.

CREATE TABLE IF NOT EXISTS "school"."school_automation_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_from" TEXT NOT NULL DEFAULT '22:00',
    "quiet_to" TEXT NOT NULL DEFAULT '07:00',
    "holiday_policy" TEXT NOT NULL DEFAULT 'PREVIOUS_WORKING_DAY',
    "max_sms_per_minute" INTEGER NOT NULL DEFAULT 40,
    "max_wa_per_minute" INTEGER NOT NULL DEFAULT 80,
    "max_email_per_minute" INTEGER NOT NULL DEFAULT 60,
    "max_push_per_minute" INTEGER NOT NULL DEFAULT 120,
    "max_per_execution" INTEGER NOT NULL DEFAULT 2000,
    "max_per_recipient_day" INTEGER NOT NULL DEFAULT 12,
    "retry_attempts" INTEGER NOT NULL DEFAULT 5,
    "emergency_bypass_quiet" BOOLEAN NOT NULL DEFAULT true,
    "default_channels_json" JSONB NOT NULL DEFAULT '["PUSH","WHATSAPP"]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_automation_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_automation_settings_tenant_id_key"
  ON "school"."school_automation_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_automation_workflows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "trigger_type" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_id" UUID,
    "graph_json" JSONB NOT NULL DEFAULT '{}',
    "schedule_json" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    CONSTRAINT "school_automation_workflows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_automation_workflows_tenant_id_status_trigger_event_idx"
  ON "school"."school_automation_workflows"("tenant_id", "status", "trigger_event");
CREATE INDEX IF NOT EXISTS "school_automation_workflows_tenant_id_trigger_type_idx"
  ON "school"."school_automation_workflows"("tenant_id", "trigger_type");

CREATE TABLE IF NOT EXISTS "school"."school_automation_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "variables_json" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_automation_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_automation_templates_tenant_id_category_channel_idx"
  ON "school"."school_automation_templates"("tenant_id", "category", "channel");

CREATE TABLE IF NOT EXISTS "school"."school_automation_executions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version" INTEGER NOT NULL DEFAULT 1,
    "code" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "student_id" UUID,
    "recipient_label" TEXT,
    "channel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "test_mode" BOOLEAN NOT NULL DEFAULT false,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_automation_executions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_automation_executions_tenant_id_idempotency_key_key"
  ON "school"."school_automation_executions"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "school_automation_executions_tenant_id_code_key"
  ON "school"."school_automation_executions"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "school_automation_executions_tenant_id_status_created_at_idx"
  ON "school"."school_automation_executions"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "school_automation_executions_tenant_id_workflow_id_created_at_idx"
  ON "school"."school_automation_executions"("tenant_id", "workflow_id", "created_at");

ALTER TABLE "school"."school_automation_executions"
  ADD CONSTRAINT "school_automation_executions_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "school"."school_automation_workflows"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_automation_execution_steps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "node_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "channel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "provider" TEXT,
    "provider_message_id" TEXT,
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "preview" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_automation_execution_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_automation_execution_steps_tenant_id_execution_id_status_idx"
  ON "school"."school_automation_execution_steps"("tenant_id", "execution_id", "status");
CREATE INDEX IF NOT EXISTS "school_automation_execution_steps_tenant_id_status_next_retry_at_idx"
  ON "school"."school_automation_execution_steps"("tenant_id", "status", "next_retry_at");

ALTER TABLE "school"."school_automation_execution_steps"
  ADD CONSTRAINT "school_automation_execution_steps_execution_id_fkey"
  FOREIGN KEY ("execution_id") REFERENCES "school"."school_automation_executions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_automation_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "workflow_id" UUID,
    "ip" TEXT,
    "old_json" JSONB NOT NULL DEFAULT '{}',
    "new_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_automation_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_automation_audit_logs_tenant_id_created_at_idx"
  ON "school"."school_automation_audit_logs"("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_automation_webhooks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "secret_enc" TEXT,
    "workflow_id" UUID,
    "allowed_ips" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_automation_webhooks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_automation_webhooks_token_hash_key"
  ON "school"."school_automation_webhooks"("token_hash");
CREATE INDEX IF NOT EXISTS "school_automation_webhooks_tenant_id_active_idx"
  ON "school"."school_automation_webhooks"("tenant_id", "active");
