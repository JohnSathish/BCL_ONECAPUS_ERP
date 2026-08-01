-- NAAC Metric Workspace Phase 1
ALTER TABLE "naac"."naac_metrics"
  ADD COLUMN IF NOT EXISTS "key_indicator_id" UUID,
  ADD COLUMN IF NOT EXISTS "metric_type" TEXT NOT NULL DEFAULT 'QLM',
  ADD COLUMN IF NOT EXISTS "weightage" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "parent_code" TEXT,
  ADD COLUMN IF NOT EXISTS "benchmark_notes" TEXT;

CREATE TABLE IF NOT EXISTS "naac"."naac_key_indicators" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "criterion_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_key_indicators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_key_indicators_tenant_id_code_key"
  ON "naac"."naac_key_indicators"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "naac_key_indicators_tenant_id_criterion_id_idx"
  ON "naac"."naac_key_indicators"("tenant_id", "criterion_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_key_indicators"
    ADD CONSTRAINT "naac_key_indicators_criterion_id_fkey"
    FOREIGN KEY ("criterion_id") REFERENCES "naac"."naac_criteria"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "naac"."naac_metrics"
    ADD CONSTRAINT "naac_metrics_key_indicator_id_fkey"
    FOREIGN KEY ("key_indicator_id") REFERENCES "naac"."naac_key_indicators"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "naac_metrics_tenant_id_key_indicator_id_idx"
  ON "naac"."naac_metrics"("tenant_id", "key_indicator_id");

CREATE TABLE IF NOT EXISTS "naac"."naac_metric_workspaces" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "metric_id" UUID NOT NULL,
  "academic_year" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "progress_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deadline" DATE,
  "narrative_draft" TEXT,
  "erp_source_hints" JSONB,
  "criterion_coordinator_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_metric_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_metric_workspaces_tenant_id_metric_id_academic_year_key"
  ON "naac"."naac_metric_workspaces"("tenant_id", "metric_id", "academic_year");
CREATE INDEX IF NOT EXISTS "naac_metric_workspaces_tenant_id_academic_year_status_idx"
  ON "naac"."naac_metric_workspaces"("tenant_id", "academic_year", "status");
CREATE INDEX IF NOT EXISTS "naac_metric_workspaces_tenant_id_status_idx"
  ON "naac"."naac_metric_workspaces"("tenant_id", "status");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_metric_workspaces"
    ADD CONSTRAINT "naac_metric_workspaces_metric_id_fkey"
    FOREIGN KEY ("metric_id") REFERENCES "naac"."naac_metrics"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_metric_assignments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "assigned_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_metric_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_metric_assignments_workspace_id_staff_profile_id_role_key"
  ON "naac"."naac_metric_assignments"("workspace_id", "staff_profile_id", "role");
CREATE INDEX IF NOT EXISTS "naac_metric_assignments_tenant_id_staff_profile_id_idx"
  ON "naac"."naac_metric_assignments"("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "naac_metric_assignments_tenant_id_workspace_id_idx"
  ON "naac"."naac_metric_assignments"("tenant_id", "workspace_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_metric_assignments"
    ADD CONSTRAINT "naac_metric_assignments_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "naac"."naac_metric_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_evidence_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "evidence_type" TEXT NOT NULL DEFAULT 'FILE',
  "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_evidence_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "naac_evidence_items_tenant_id_workspace_id_idx"
  ON "naac"."naac_evidence_items"("tenant_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "naac_evidence_items_tenant_id_verification_status_idx"
  ON "naac"."naac_evidence_items"("tenant_id", "verification_status");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_evidence_items"
    ADD CONSTRAINT "naac_evidence_items_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "naac"."naac_metric_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_evidence_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "evidence_item_id" UUID NOT NULL,
  "version_no" INTEGER NOT NULL,
  "storage_key" TEXT,
  "file_name" TEXT,
  "mime_type" TEXT,
  "file_size" INTEGER,
  "external_url" TEXT,
  "change_note" TEXT,
  "uploaded_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_evidence_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_evidence_versions_evidence_item_id_version_no_key"
  ON "naac"."naac_evidence_versions"("evidence_item_id", "version_no");
CREATE INDEX IF NOT EXISTS "naac_evidence_versions_tenant_id_evidence_item_id_idx"
  ON "naac"."naac_evidence_versions"("tenant_id", "evidence_item_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_evidence_versions"
    ADD CONSTRAINT "naac_evidence_versions_evidence_item_id_fkey"
    FOREIGN KEY ("evidence_item_id") REFERENCES "naac"."naac_evidence_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_metric_comments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "author_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_metric_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "naac_metric_comments_tenant_id_workspace_id_created_at_idx"
  ON "naac"."naac_metric_comments"("tenant_id", "workspace_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_metric_comments"
    ADD CONSTRAINT "naac_metric_comments_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "naac"."naac_metric_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_metric_approvals" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "step" TEXT NOT NULL,
  "remark" TEXT,
  "actor_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_metric_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "naac_metric_approvals_tenant_id_workspace_id_created_at_idx"
  ON "naac"."naac_metric_approvals"("tenant_id", "workspace_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_metric_approvals"
    ADD CONSTRAINT "naac_metric_approvals_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "naac"."naac_metric_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_audit_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" UUID,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "naac_audit_events_tenant_id_entity_type_entity_id_created_at_idx"
  ON "naac"."naac_audit_events"("tenant_id", "entity_type", "entity_id", "created_at");
CREATE INDEX IF NOT EXISTS "naac_audit_events_tenant_id_created_at_idx"
  ON "naac"."naac_audit_events"("tenant_id", "created_at");
