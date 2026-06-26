-- Custom report builder: saved reports and per-user favorites
CREATE TABLE "platform"."saved_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "created_by_id" UUID,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'STUDENTS',
    "report_kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "builtin_key" TEXT,
    "is_system_template" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "sort_by" TEXT,
    "sort_direction" TEXT,
    "group_by" TEXT,
    "layout" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."saved_report_favorites" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "saved_report_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_report_favorites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saved_reports_tenant_id_module_deleted_at_idx" ON "platform"."saved_reports"("tenant_id", "module", "deleted_at");
CREATE INDEX "saved_reports_tenant_id_builtin_key_idx" ON "platform"."saved_reports"("tenant_id", "builtin_key");
CREATE INDEX "saved_report_favorites_tenant_id_user_id_idx" ON "platform"."saved_report_favorites"("tenant_id", "user_id");

CREATE UNIQUE INDEX "saved_report_favorites_user_id_saved_report_id_key" ON "platform"."saved_report_favorites"("user_id", "saved_report_id");

ALTER TABLE "platform"."saved_report_favorites" ADD CONSTRAINT "saved_report_favorites_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "platform"."saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform"."saved_report_favorites" ADD CONSTRAINT "saved_report_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
