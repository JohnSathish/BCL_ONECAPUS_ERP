-- Scheduled report definitions (execution via worker in a later release)
CREATE TABLE "platform"."scheduled_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_by_id" UUID,
    "saved_report_id" UUID,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'STUDENTS',
    "schedule_type" TEXT NOT NULL,
    "schedule_day" INTEGER,
    "schedule_time" TEXT,
    "format" TEXT NOT NULL DEFAULT 'xlsx',
    "recipient_emails" JSONB,
    "filter_overrides" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_reports_tenant_id_module_is_active_idx" ON "platform"."scheduled_reports"("tenant_id", "module", "is_active");
CREATE INDEX "scheduled_reports_tenant_id_next_run_at_idx" ON "platform"."scheduled_reports"("tenant_id", "next_run_at");

ALTER TABLE "platform"."scheduled_reports" ADD CONSTRAINT "scheduled_reports_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "platform"."saved_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
