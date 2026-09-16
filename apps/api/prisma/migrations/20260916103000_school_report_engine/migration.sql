-- Idempotent with 20260916100000: same tables, correct audit map name.

CREATE TABLE IF NOT EXISTS "school"."school_report_design" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_report_design_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_report_design_tenant_id_key"
  ON "school"."school_report_design"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_report_export_audit" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "report_key" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filters_json" JSONB NOT NULL DEFAULT '{}',
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_report_export_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_report_export_audit_tenant_id_created_at_idx"
  ON "school"."school_report_export_audit"("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "school_report_export_audit_tenant_id_report_key_idx"
  ON "school"."school_report_export_audit"("tenant_id", "report_key");
