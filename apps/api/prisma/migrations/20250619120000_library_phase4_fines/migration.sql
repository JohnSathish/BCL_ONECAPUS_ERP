-- Smart Library Phase 4: fine automation, renewals, overdue reminder dedupe

ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "block_issue_on_unpaid_fines" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "overdue_notify_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "max_renewals" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "library"."library_loans"
  ADD COLUMN IF NOT EXISTS "renewal_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "library"."library_fines"
  ADD COLUMN IF NOT EXISTS "paid_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "waived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waived_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "waive_reason" TEXT;

CREATE INDEX IF NOT EXISTS "library_fines_tenant_id_paid_at_waived_at_idx"
  ON "library"."library_fines"("tenant_id", "paid_at", "waived_at");

CREATE TABLE IF NOT EXISTS "library"."library_overdue_reminder_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "loan_id" UUID NOT NULL,
  "sent_on" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_overdue_reminder_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_overdue_reminder_logs_tenant_id_loan_id_sent_on_key"
  ON "library"."library_overdue_reminder_logs"("tenant_id", "loan_id", "sent_on");

CREATE INDEX IF NOT EXISTS "library_overdue_reminder_logs_tenant_id_sent_on_idx"
  ON "library"."library_overdue_reminder_logs"("tenant_id", "sent_on");
