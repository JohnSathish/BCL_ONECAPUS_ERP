-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "naac";

-- CreateTable
CREATE TABLE "naac"."naac_criteria" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "criterion" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_metrics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "criterion_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data_type" TEXT NOT NULL DEFAULT 'document',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_vault_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naac_vault_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_evidence_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "criterion" INTEGER NOT NULL,
    "metric_code" TEXT,
    "academic_year" TEXT NOT NULL,
    "department_id" UUID,
    "committee_id" UUID,
    "programme_id" UUID,
    "activity_title" TEXT,
    "event_title" TEXT,
    "evidence_notes" TEXT,
    "file_name" TEXT,
    "storage_key" TEXT,
    "file_url" TEXT,
    "vault_document_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naac_evidence_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_aqars" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "institution_profile" JSONB,
    "completion_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_aqars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_aqar_sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "aqar_id" UUID NOT NULL,
    "section_key" TEXT NOT NULL,
    "content" JSONB,
    "completion_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_aqar_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_faculty_achievements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "achievement_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "achievement_date" DATE,
    "staff_publication_id" UUID,
    "staff_award_id" UUID,
    "evidence_tag_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_faculty_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_student_achievements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID,
    "achievement_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "achievement_date" DATE,
    "department_id" UUID,
    "evidence_tag_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_student_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_mous" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "partner_type" TEXT NOT NULL,
    "partner_name" TEXT NOT NULL,
    "signed_at" DATE,
    "expires_at" DATE,
    "storage_key" TEXT,
    "file_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_mous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_mou_activities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mou_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "activity_date" DATE,
    "outcomes" TEXT,
    "report_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_mou_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_department_submissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "academic_year" TEXT NOT NULL,
    "submission_type" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_by_id" UUID,
    "reviewed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_department_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_calendar_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "description" TEXT,
    "linked_source_type" TEXT,
    "linked_source_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "active_aqar_year" TEXT,
    "institution_profile" JSONB,
    "metadata" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "naac_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naac"."naac_readiness_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "criterion_scores" JSONB NOT NULL,
    "pending_counts" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naac_readiness_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "naac_criteria_tenant_id_criterion_key" ON "naac"."naac_criteria"("tenant_id", "criterion");
CREATE INDEX "naac_criteria_tenant_id_idx" ON "naac"."naac_criteria"("tenant_id");

CREATE UNIQUE INDEX "naac_metrics_tenant_id_code_key" ON "naac"."naac_metrics"("tenant_id", "code");
CREATE INDEX "naac_metrics_tenant_id_criterion_id_idx" ON "naac"."naac_metrics"("tenant_id", "criterion_id");

CREATE INDEX "naac_vault_documents_tenant_id_created_at_idx" ON "naac"."naac_vault_documents"("tenant_id", "created_at");

CREATE INDEX "naac_evidence_tags_tenant_id_criterion_idx" ON "naac"."naac_evidence_tags"("tenant_id", "criterion");
CREATE INDEX "naac_evidence_tags_tenant_id_academic_year_idx" ON "naac"."naac_evidence_tags"("tenant_id", "academic_year");
CREATE INDEX "naac_evidence_tags_tenant_id_source_type_source_id_idx" ON "naac"."naac_evidence_tags"("tenant_id", "source_type", "source_id");
CREATE INDEX "naac_evidence_tags_tenant_id_metric_code_idx" ON "naac"."naac_evidence_tags"("tenant_id", "metric_code");
CREATE INDEX "naac_evidence_tags_tenant_id_department_id_idx" ON "naac"."naac_evidence_tags"("tenant_id", "department_id");

CREATE UNIQUE INDEX "naac_aqars_tenant_id_academic_year_key" ON "naac"."naac_aqars"("tenant_id", "academic_year");
CREATE INDEX "naac_aqars_tenant_id_status_idx" ON "naac"."naac_aqars"("tenant_id", "status");

CREATE UNIQUE INDEX "naac_aqar_sections_tenant_id_aqar_id_section_key_key" ON "naac"."naac_aqar_sections"("tenant_id", "aqar_id", "section_key");
CREATE INDEX "naac_aqar_sections_tenant_id_aqar_id_idx" ON "naac"."naac_aqar_sections"("tenant_id", "aqar_id");

CREATE INDEX "naac_faculty_achievements_tenant_id_staff_profile_id_idx" ON "naac"."naac_faculty_achievements"("tenant_id", "staff_profile_id");
CREATE INDEX "naac_faculty_achievements_tenant_id_achievement_type_idx" ON "naac"."naac_faculty_achievements"("tenant_id", "achievement_type");

CREATE INDEX "naac_student_achievements_tenant_id_achievement_type_idx" ON "naac"."naac_student_achievements"("tenant_id", "achievement_type");
CREATE INDEX "naac_student_achievements_tenant_id_student_id_idx" ON "naac"."naac_student_achievements"("tenant_id", "student_id");

CREATE INDEX "naac_mous_tenant_id_partner_type_idx" ON "naac"."naac_mous"("tenant_id", "partner_type");
CREATE INDEX "naac_mou_activities_tenant_id_mou_id_idx" ON "naac"."naac_mou_activities"("tenant_id", "mou_id");

CREATE INDEX "naac_department_submissions_tenant_id_department_id_idx" ON "naac"."naac_department_submissions"("tenant_id", "department_id");
CREATE INDEX "naac_department_submissions_tenant_id_academic_year_idx" ON "naac"."naac_department_submissions"("tenant_id", "academic_year");

CREATE INDEX "naac_calendar_events_tenant_id_due_date_idx" ON "naac"."naac_calendar_events"("tenant_id", "due_date");
CREATE INDEX "naac_calendar_events_tenant_id_event_type_idx" ON "naac"."naac_calendar_events"("tenant_id", "event_type");

CREATE UNIQUE INDEX "naac_settings_tenant_id_key" ON "naac"."naac_settings"("tenant_id");

CREATE UNIQUE INDEX "naac_readiness_snapshots_tenant_id_academic_year_key" ON "naac"."naac_readiness_snapshots"("tenant_id", "academic_year");
CREATE INDEX "naac_readiness_snapshots_tenant_id_computed_at_idx" ON "naac"."naac_readiness_snapshots"("tenant_id", "computed_at");

-- AddForeignKey
ALTER TABLE "naac"."naac_metrics" ADD CONSTRAINT "naac_metrics_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "naac"."naac_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "naac"."naac_evidence_tags" ADD CONSTRAINT "naac_evidence_tags_vault_document_id_fkey" FOREIGN KEY ("vault_document_id") REFERENCES "naac"."naac_vault_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "naac"."naac_aqar_sections" ADD CONSTRAINT "naac_aqar_sections_aqar_id_fkey" FOREIGN KEY ("aqar_id") REFERENCES "naac"."naac_aqars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "naac"."naac_faculty_achievements" ADD CONSTRAINT "naac_faculty_achievements_evidence_tag_id_fkey" FOREIGN KEY ("evidence_tag_id") REFERENCES "naac"."naac_evidence_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "naac"."naac_mou_activities" ADD CONSTRAINT "naac_mou_activities_mou_id_fkey" FOREIGN KEY ("mou_id") REFERENCES "naac"."naac_mous"("id") ON DELETE CASCADE ON UPDATE CASCADE;
