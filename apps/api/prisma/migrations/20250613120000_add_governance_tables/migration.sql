-- Governance (CGMS) tables in core schema

CREATE TABLE IF NOT EXISTS "core"."governance_committees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "committee_type" TEXT NOT NULL DEFAULT 'STANDING',
    "category" TEXT NOT NULL,
    "description" TEXT,
    "academic_year" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "metadata" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_committees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "governance_committees_tenant_id_short_code_key"
    ON "core"."governance_committees"("tenant_id", "short_code");
CREATE INDEX IF NOT EXISTS "governance_committees_tenant_id_status_idx"
    ON "core"."governance_committees"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "governance_committees_tenant_id_category_idx"
    ON "core"."governance_committees"("tenant_id", "category");

CREATE TABLE IF NOT EXISTS "core"."governance_committee_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "staff_profile_id" UUID,
    "student_id" UUID,
    "user_id" UUID,
    "display_name" TEXT NOT NULL,
    "designation" TEXT,
    "role" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "joining_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_committee_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_committee_members_tenant_id_committee_id_idx"
    ON "core"."governance_committee_members"("tenant_id", "committee_id");
CREATE INDEX IF NOT EXISTS "governance_committee_members_tenant_id_staff_profile_id_idx"
    ON "core"."governance_committee_members"("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "governance_committee_members_tenant_id_user_id_idx"
    ON "core"."governance_committee_members"("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "core"."governance_meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "meeting_time" TEXT,
    "venue" TEXT,
    "meeting_mode" TEXT NOT NULL DEFAULT 'PHYSICAL',
    "agenda" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "qr_token" TEXT,
    "otp_code_hash" TEXT,
    "attachments" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_meetings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_meetings_tenant_id_committee_id_idx"
    ON "core"."governance_meetings"("tenant_id", "committee_id");
CREATE INDEX IF NOT EXISTS "governance_meetings_tenant_id_meeting_date_idx"
    ON "core"."governance_meetings"("tenant_id", "meeting_date");
CREATE INDEX IF NOT EXISTS "governance_meetings_tenant_id_status_idx"
    ON "core"."governance_meetings"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "core"."governance_meeting_agenda_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_meeting_agenda_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_meeting_agenda_items_tenant_id_meeting_id_idx"
    ON "core"."governance_meeting_agenda_items"("tenant_id", "meeting_id");

CREATE TABLE IF NOT EXISTS "core"."governance_meeting_attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "member_id" UUID,
    "user_id" UUID,
    "display_name" TEXT,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'ABSENT',
    "marked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_meeting_attendance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_meeting_attendance_tenant_id_meeting_id_idx"
    ON "core"."governance_meeting_attendance"("tenant_id", "meeting_id");

CREATE TABLE IF NOT EXISTS "core"."governance_meeting_minutes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "discussion" TEXT,
    "decisions" TEXT,
    "resolutions" TEXT,
    "future_actions" TEXT,
    "attachments" JSONB,
    "pdf_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_meeting_minutes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_meeting_minutes_tenant_id_meeting_id_idx"
    ON "core"."governance_meeting_minutes"("tenant_id", "meeting_id");

CREATE TABLE IF NOT EXISTS "core"."governance_action_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "meeting_id" UUID,
    "action_item" TEXT NOT NULL,
    "assigned_to_id" UUID,
    "assigned_name" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "target_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "evidence_files" JSONB,
    "completed_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_action_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_action_items_tenant_id_committee_id_idx"
    ON "core"."governance_action_items"("tenant_id", "committee_id");
CREATE INDEX IF NOT EXISTS "governance_action_items_tenant_id_status_idx"
    ON "core"."governance_action_items"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "governance_action_items_tenant_id_assigned_to_id_idx"
    ON "core"."governance_action_items"("tenant_id", "assigned_to_id");

CREATE TABLE IF NOT EXISTS "core"."governance_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigned_to_id" UUID,
    "assigned_name" TEXT,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_tasks_tenant_id_committee_id_idx"
    ON "core"."governance_tasks"("tenant_id", "committee_id");
CREATE INDEX IF NOT EXISTS "governance_tasks_tenant_id_status_idx"
    ON "core"."governance_tasks"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "core"."governance_notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "committee_id" UUID,
    "notice_no" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'COMMITTEE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_notices_tenant_id_status_idx"
    ON "core"."governance_notices"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "governance_notices_tenant_id_committee_id_idx"
    ON "core"."governance_notices"("tenant_id", "committee_id");

CREATE TABLE IF NOT EXISTS "core"."governance_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "committee_id" UUID,
    "folder_path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "academic_year" TEXT,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_documents_tenant_id_committee_id_idx"
    ON "core"."governance_documents"("tenant_id", "committee_id");
CREATE INDEX IF NOT EXISTS "governance_documents_tenant_id_category_idx"
    ON "core"."governance_documents"("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "governance_documents_tenant_id_folder_path_idx"
    ON "core"."governance_documents"("tenant_id", "folder_path");

CREATE TABLE IF NOT EXISTS "core"."governance_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "venue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_events_tenant_id_committee_id_idx"
    ON "core"."governance_events"("tenant_id", "committee_id");
CREATE INDEX IF NOT EXISTS "governance_events_tenant_id_start_date_idx"
    ON "core"."governance_events"("tenant_id", "start_date");

CREATE TABLE IF NOT EXISTS "core"."governance_naac_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "criterion" INTEGER NOT NULL,
    "evidence_notes" TEXT,
    "document_id" UUID,
    "event_id" UUID,
    "action_item_id" UUID,
    "notice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_naac_tags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_naac_tags_tenant_id_entity_type_entity_id_idx"
    ON "core"."governance_naac_tags"("tenant_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "governance_naac_tags_tenant_id_criterion_idx"
    ON "core"."governance_naac_tags"("tenant_id", "criterion");

CREATE TABLE IF NOT EXISTS "core"."governance_import_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "raw_text" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_import_batches_tenant_id_status_idx"
    ON "core"."governance_import_batches"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "core"."governance_import_drafts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "parsed_json" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_status" TEXT NOT NULL DEFAULT 'PENDING',
    "committed_at" TIMESTAMP(3),
    "committee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_import_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_import_drafts_tenant_id_batch_id_idx"
    ON "core"."governance_import_drafts"("tenant_id", "batch_id");

CREATE TABLE IF NOT EXISTS "core"."governance_performance_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "academic_year" TEXT NOT NULL,
    "score_total" DOUBLE PRECISION NOT NULL,
    "score_breakdown" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_performance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "governance_performance_snapshots_tenant_id_committee_id_academic_year_key"
    ON "core"."governance_performance_snapshots"("tenant_id", "committee_id", "academic_year");
CREATE INDEX IF NOT EXISTS "governance_performance_snapshots_tenant_id_score_total_idx"
    ON "core"."governance_performance_snapshots"("tenant_id", "score_total");

CREATE TABLE IF NOT EXISTS "core"."governance_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "default_academic_year" TEXT,
    "notice_prefix" TEXT NOT NULL DEFAULT 'DBC/CIRC',
    "notify_email" BOOLEAN NOT NULL DEFAULT true,
    "notify_in_app" BOOLEAN NOT NULL DEFAULT true,
    "notify_push" BOOLEAN NOT NULL DEFAULT true,
    "notify_sms" BOOLEAN NOT NULL DEFAULT false,
    "qr_attendance_enabled" BOOLEAN NOT NULL DEFAULT true,
    "performance_weights" JSONB,
    "metadata" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "governance_settings_tenant_id_key"
    ON "core"."governance_settings"("tenant_id");

-- Foreign keys (idempotent via DO blocks)
DO $$ BEGIN
  ALTER TABLE "core"."governance_committee_members"
    ADD CONSTRAINT "governance_committee_members_committee_id_fkey"
    FOREIGN KEY ("committee_id") REFERENCES "core"."governance_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_meetings"
    ADD CONSTRAINT "governance_meetings_committee_id_fkey"
    FOREIGN KEY ("committee_id") REFERENCES "core"."governance_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_meeting_agenda_items"
    ADD CONSTRAINT "governance_meeting_agenda_items_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "core"."governance_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_meeting_attendance"
    ADD CONSTRAINT "governance_meeting_attendance_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "core"."governance_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_meeting_attendance"
    ADD CONSTRAINT "governance_meeting_attendance_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "core"."governance_committee_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_meeting_minutes"
    ADD CONSTRAINT "governance_meeting_minutes_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "core"."governance_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_action_items"
    ADD CONSTRAINT "governance_action_items_committee_id_fkey"
    FOREIGN KEY ("committee_id") REFERENCES "core"."governance_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_action_items"
    ADD CONSTRAINT "governance_action_items_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "core"."governance_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_tasks"
    ADD CONSTRAINT "governance_tasks_committee_id_fkey"
    FOREIGN KEY ("committee_id") REFERENCES "core"."governance_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_notices"
    ADD CONSTRAINT "governance_notices_committee_id_fkey"
    FOREIGN KEY ("committee_id") REFERENCES "core"."governance_committees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_documents"
    ADD CONSTRAINT "governance_documents_committee_id_fkey"
    FOREIGN KEY ("committee_id") REFERENCES "core"."governance_committees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_events"
    ADD CONSTRAINT "governance_events_committee_id_fkey"
    FOREIGN KEY ("committee_id") REFERENCES "core"."governance_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_naac_tags"
    ADD CONSTRAINT "governance_naac_tags_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "core"."governance_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_naac_tags"
    ADD CONSTRAINT "governance_naac_tags_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "core"."governance_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_naac_tags"
    ADD CONSTRAINT "governance_naac_tags_action_item_id_fkey"
    FOREIGN KEY ("action_item_id") REFERENCES "core"."governance_action_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_naac_tags"
    ADD CONSTRAINT "governance_naac_tags_notice_id_fkey"
    FOREIGN KEY ("notice_id") REFERENCES "core"."governance_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_import_drafts"
    ADD CONSTRAINT "governance_import_drafts_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "core"."governance_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "core"."governance_performance_snapshots"
    ADD CONSTRAINT "governance_performance_snapshots_committee_id_fkey"
    FOREIGN KEY ("committee_id") REFERENCES "core"."governance_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
