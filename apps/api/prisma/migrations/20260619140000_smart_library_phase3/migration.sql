-- BCL Smart Library Phase 3 — copy incidents, due-tomorrow reminders

ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "due_tomorrow_notify_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "library"."library_copy_incidents" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "copy_id" UUID NOT NULL,
  "loan_id" UUID,
  "incident_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "charge_amount" DECIMAL(12, 2),
  "replacement_copy_id" UUID,
  "reported_by_id" UUID,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_copy_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_copy_incidents_tenant_id_status_idx"
  ON "library"."library_copy_incidents"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "library_copy_incidents_tenant_id_copy_id_idx"
  ON "library"."library_copy_incidents"("tenant_id", "copy_id");

CREATE TABLE IF NOT EXISTS "library"."library_due_reminder_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "loan_id" UUID NOT NULL,
  "sent_on" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_due_reminder_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_due_reminder_logs_tenant_id_loan_id_sent_on_key"
  ON "library"."library_due_reminder_logs"("tenant_id", "loan_id", "sent_on");

CREATE INDEX IF NOT EXISTS "library_due_reminder_logs_tenant_id_sent_on_idx"
  ON "library"."library_due_reminder_logs"("tenant_id", "sent_on");
