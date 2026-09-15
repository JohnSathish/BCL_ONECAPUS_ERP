-- School SIS MIS / reports metadata. Isolated school schema.

CREATE TABLE IF NOT EXISTS "school"."school_mis_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "attendance_min_percent" INTEGER NOT NULL DEFAULT 75,
    "pass_percent" INTEGER NOT NULL DEFAULT 33,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "footer_text" TEXT,
    "signatory_name" TEXT,
    "page_format" TEXT NOT NULL DEFAULT 'A4',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_mis_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_mis_settings_tenant_id_key"
  ON "school"."school_mis_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_mis_saved_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "filters_json" JSONB NOT NULL DEFAULT '{}',
    "columns_json" JSONB NOT NULL DEFAULT '[]',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_mis_saved_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_mis_saved_reports_tenant_id_category_created_by_idx"
  ON "school"."school_mis_saved_reports"("tenant_id", "category", "created_by");

CREATE TABLE IF NOT EXISTS "school"."school_mis_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "saved_report_id" UUID,
    "report_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "time_of_day" TEXT NOT NULL DEFAULT '08:00',
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "filters_json" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_mis_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_mis_schedules_tenant_id_active_frequency_idx"
  ON "school"."school_mis_schedules"("tenant_id", "active", "frequency");

CREATE TABLE IF NOT EXISTS "school"."school_mis_exports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "report_key" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATING',
    "file_key" TEXT,
    "error" TEXT,
    "filters_json" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "school_mis_exports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_mis_exports_tenant_id_created_by_created_at_idx"
  ON "school"."school_mis_exports"("tenant_id", "created_by", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_mis_audit" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "report_key" TEXT,
    "filters_json" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_mis_audit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_mis_audit_tenant_id_created_at_idx"
  ON "school"."school_mis_audit"("tenant_id", "created_at");
