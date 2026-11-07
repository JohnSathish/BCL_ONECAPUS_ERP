-- Append-only security monitoring tables for the college Security Centre.
-- Ordinary application sessions cannot update or delete security_events.
-- A database administrator can purge during tenant offboarding only by setting
-- `SET LOCAL onecampus.allow_security_purge = 'on'` inside the same transaction.

CREATE TABLE "platform"."security_events" (
    "id" UUID NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "module" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "summary" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "subject_key" TEXT,
    "prev_hash" TEXT,
    "record_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_events_tenant_id_created_at_idx"
    ON "platform"."security_events"("tenant_id", "created_at");
CREATE INDEX "security_events_tenant_id_event_type_created_at_idx"
    ON "platform"."security_events"("tenant_id", "event_type", "created_at");
CREATE INDEX "security_events_tenant_id_subject_key_created_at_idx"
    ON "platform"."security_events"("tenant_id", "subject_key", "created_at");
CREATE INDEX "security_events_tenant_id_seq_idx"
    ON "platform"."security_events"("tenant_id", "seq");

CREATE OR REPLACE FUNCTION "platform"."prevent_security_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('onecampus.allow_security_purge', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'security_events are append-only and cannot be %', TG_OP
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS "security_events_append_only" ON "platform"."security_events";
CREATE TRIGGER "security_events_append_only"
    BEFORE UPDATE OR DELETE ON "platform"."security_events"
    FOR EACH ROW
    EXECUTE FUNCTION "platform"."prevent_security_event_mutation"();

CREATE TABLE "platform"."security_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rule_code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "subject_key" TEXT,
    "source_event_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "notified_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_alerts_tenant_id_status_created_at_idx"
    ON "platform"."security_alerts"("tenant_id", "status", "created_at");
CREATE INDEX "security_alerts_tenant_id_rule_code_subject_key_created_at_idx"
    ON "platform"."security_alerts"("tenant_id", "rule_code", "subject_key", "created_at");

CREATE OR REPLACE FUNCTION "platform"."protect_security_alert_facts"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF current_setting('onecampus.allow_security_purge', true) = 'on' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'security_alerts cannot be deleted'
            USING ERRCODE = '42501';
    END IF;
    IF NEW.rule_code IS DISTINCT FROM OLD.rule_code
       OR NEW.severity IS DISTINCT FROM OLD.severity
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.summary IS DISTINCT FROM OLD.summary
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.subject_key IS DISTINCT FROM OLD.subject_key
       OR NEW.source_event_id IS DISTINCT FROM OLD.source_event_id
       OR NEW.metadata IS DISTINCT FROM OLD.metadata
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'security alert facts are immutable'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "security_alerts_immutable_facts" ON "platform"."security_alerts";
CREATE TRIGGER "security_alerts_immutable_facts"
    BEFORE UPDATE OR DELETE ON "platform"."security_alerts"
    FOR EACH ROW
    EXECUTE FUNCTION "platform"."protect_security_alert_facts"();

CREATE TABLE "platform"."security_monitor_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "max_failures" INTEGER NOT NULL DEFAULT 8,
    "window_minutes" INTEGER NOT NULL DEFAULT 20,
    "lock_minutes" INTEGER NOT NULL DEFAULT 5,
    "escalated_lock_minutes" INTEGER NOT NULL DEFAULT 15,
    "failed_login_alert_threshold" INTEGER NOT NULL DEFAULT 5,
    "suspicious_ip_min_identifiers" INTEGER NOT NULL DEFAULT 4,
    "unauthorized_api_threshold" INTEGER NOT NULL DEFAULT 10,
    "bulk_download_threshold" INTEGER NOT NULL DEFAULT 15,
    "bulk_mutation_threshold" INTEGER NOT NULL DEFAULT 25,
    "notify_in_app" BOOLEAN NOT NULL DEFAULT true,
    "notify_email" BOOLEAN NOT NULL DEFAULT true,
    "file_integrity_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_monitor_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "security_monitor_configs_tenant_id_key"
    ON "platform"."security_monitor_configs"("tenant_id");

CREATE TABLE "platform"."security_file_baselines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "relative_path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BASELINE',
    "baseline_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_file_baselines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "security_file_baselines_tenant_id_relative_path_key"
    ON "platform"."security_file_baselines"("tenant_id", "relative_path");
CREATE INDEX "security_file_baselines_tenant_id_status_idx"
    ON "platform"."security_file_baselines"("tenant_id", "status");
