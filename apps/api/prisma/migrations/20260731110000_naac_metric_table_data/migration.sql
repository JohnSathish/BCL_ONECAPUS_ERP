-- NAAC Phase 2B — Official Excel metric data tables
CREATE TABLE IF NOT EXISTS "naac"."naac_metric_table_definitions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "sheet_name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "metric_codes" JSONB NOT NULL,
  "columns" JSONB NOT NULL,
  "layout_hints" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_metric_table_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_metric_table_definitions_tenant_id_code_key"
  ON "naac"."naac_metric_table_definitions"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "naac_metric_table_definitions_tenant_id_sort_order_idx"
  ON "naac"."naac_metric_table_definitions"("tenant_id", "sort_order");

CREATE TABLE IF NOT EXISTS "naac"."naac_metric_table_datasets" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "table_definition_id" UUID NOT NULL,
  "academic_year" TEXT NOT NULL,
  "year_index" INTEGER NOT NULL DEFAULT 1,
  "last_pulled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_metric_table_datasets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_metric_table_datasets_workspace_def_year_key"
  ON "naac"."naac_metric_table_datasets"("workspace_id", "table_definition_id", "year_index");
CREATE INDEX IF NOT EXISTS "naac_metric_table_datasets_tenant_id_academic_year_idx"
  ON "naac"."naac_metric_table_datasets"("tenant_id", "academic_year");
CREATE INDEX IF NOT EXISTS "naac_metric_table_datasets_tenant_id_workspace_id_idx"
  ON "naac"."naac_metric_table_datasets"("tenant_id", "workspace_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_metric_table_datasets"
    ADD CONSTRAINT "naac_metric_table_datasets_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "naac"."naac_metric_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "naac"."naac_metric_table_datasets"
    ADD CONSTRAINT "naac_metric_table_datasets_table_definition_id_fkey"
    FOREIGN KEY ("table_definition_id") REFERENCES "naac"."naac_metric_table_definitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_metric_table_rows" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "dataset_id" UUID NOT NULL,
  "row_index" INTEGER NOT NULL,
  "cells" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_metric_table_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_metric_table_rows_dataset_id_row_index_key"
  ON "naac"."naac_metric_table_rows"("dataset_id", "row_index");
CREATE INDEX IF NOT EXISTS "naac_metric_table_rows_tenant_id_dataset_id_idx"
  ON "naac"."naac_metric_table_rows"("tenant_id", "dataset_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_metric_table_rows"
    ADD CONSTRAINT "naac_metric_table_rows_dataset_id_fkey"
    FOREIGN KEY ("dataset_id") REFERENCES "naac"."naac_metric_table_datasets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
