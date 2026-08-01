-- NAAC Phase 3 — DVV clarification cases
CREATE TABLE IF NOT EXISTS "naac"."naac_dvv_clarifications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "metric_id" UUID NOT NULL,
  "workspace_id" UUID,
  "academic_year" TEXT NOT NULL,
  "query_code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "naac_query_text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assigned_faculty_id" UUID,
  "workflow_instance_id" UUID,
  "due_date" TIMESTAMP(3),
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_dvv_clarifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_dvv_clarifications_tenant_year_query_key"
  ON "naac"."naac_dvv_clarifications"("tenant_id", "academic_year", "query_code");
CREATE INDEX IF NOT EXISTS "naac_dvv_clarifications_tenant_id_status_idx"
  ON "naac"."naac_dvv_clarifications"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "naac_dvv_clarifications_tenant_id_metric_id_idx"
  ON "naac"."naac_dvv_clarifications"("tenant_id", "metric_id");
CREATE INDEX IF NOT EXISTS "naac_dvv_clarifications_tenant_id_assigned_faculty_id_idx"
  ON "naac"."naac_dvv_clarifications"("tenant_id", "assigned_faculty_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_dvv_clarifications"
    ADD CONSTRAINT "naac_dvv_clarifications_metric_id_fkey"
    FOREIGN KEY ("metric_id") REFERENCES "naac"."naac_metrics"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "naac"."naac_dvv_clarifications"
    ADD CONSTRAINT "naac_dvv_clarifications_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "naac"."naac_metric_workspaces"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_dvv_evidence_links" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "clarification_id" UUID NOT NULL,
  "evidence_item_id" UUID,
  "vault_document_id" UUID,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_dvv_evidence_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "naac_dvv_evidence_links_tenant_id_clarification_id_idx"
  ON "naac"."naac_dvv_evidence_links"("tenant_id", "clarification_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_dvv_evidence_links"
    ADD CONSTRAINT "naac_dvv_evidence_links_clarification_id_fkey"
    FOREIGN KEY ("clarification_id") REFERENCES "naac"."naac_dvv_clarifications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_dvv_response_drafts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "clarification_id" UUID NOT NULL,
  "version_no" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "attachment_key" TEXT,
  "attachment_name" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_dvv_response_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_dvv_response_drafts_clarification_id_version_no_key"
  ON "naac"."naac_dvv_response_drafts"("clarification_id", "version_no");
CREATE INDEX IF NOT EXISTS "naac_dvv_response_drafts_tenant_id_clarification_id_idx"
  ON "naac"."naac_dvv_response_drafts"("tenant_id", "clarification_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_dvv_response_drafts"
    ADD CONSTRAINT "naac_dvv_response_drafts_clarification_id_fkey"
    FOREIGN KEY ("clarification_id") REFERENCES "naac"."naac_dvv_clarifications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "naac"."naac_dvv_comments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "clarification_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "author_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_dvv_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "naac_dvv_comments_tenant_id_clarification_id_idx"
  ON "naac"."naac_dvv_comments"("tenant_id", "clarification_id");

DO $$ BEGIN
  ALTER TABLE "naac"."naac_dvv_comments"
    ADD CONSTRAINT "naac_dvv_comments_clarification_id_fkey"
    FOREIGN KEY ("clarification_id") REFERENCES "naac"."naac_dvv_clarifications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
