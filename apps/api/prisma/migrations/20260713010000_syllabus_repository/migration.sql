-- Academic Syllabus Repository

CREATE TABLE "academic"."syllabus_repository_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "max_upload_mb" INTEGER NOT NULL DEFAULT 25,
    "allowed_mime_types" JSONB NOT NULL DEFAULT '[]',
    "student_access_enabled" BOOLEAN NOT NULL DEFAULT true,
    "watermark_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_repository_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "syllabus_repository_settings_tenant_id_key" ON "academic"."syllabus_repository_settings"("tenant_id");

CREATE TABLE "academic"."syllabus_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "program_id" UUID,
    "program_version_id" UUID,
    "department_id" UUID,
    "academic_year_id" UUID,
    "paper_code" TEXT NOT NULL,
    "paper_title" TEXT NOT NULL,
    "semester_no" INTEGER,
    "credits" DECIMAL(5,2),
    "subject_type" TEXT,
    "category" TEXT,
    "curriculum_version" TEXT,
    "version_label" TEXT,
    "effective_from" DATE,
    "effective_to" DATE,
    "file_path" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "checksum_sha256" TEXT,
    "current_version_no" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "search_text" TEXT,
    "uploaded_by_id" UUID,
    "approved_by_id" UUID,
    "published_by_id" UUID,
    "published_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "knowledge_document_id" UUID,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "syllabus_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "syllabus_documents_tenant_id_course_id_idx" ON "academic"."syllabus_documents"("tenant_id", "course_id");
CREATE INDEX "syllabus_documents_tenant_id_status_idx" ON "academic"."syllabus_documents"("tenant_id", "status");
CREATE INDEX "syllabus_documents_tenant_id_paper_code_idx" ON "academic"."syllabus_documents"("tenant_id", "paper_code");
CREATE INDEX "syllabus_documents_tenant_id_department_id_idx" ON "academic"."syllabus_documents"("tenant_id", "department_id");
CREATE INDEX "syllabus_documents_tenant_id_semester_no_idx" ON "academic"."syllabus_documents"("tenant_id", "semester_no");
CREATE INDEX "syllabus_documents_tenant_id_category_idx" ON "academic"."syllabus_documents"("tenant_id", "category");

CREATE TABLE "academic"."syllabus_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "checksum_sha256" TEXT,
    "uploaded_by_id" UUID,
    "change_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "syllabus_versions_document_id_version_no_key" ON "academic"."syllabus_versions"("document_id", "version_no");
CREATE INDEX "syllabus_versions_tenant_id_document_id_idx" ON "academic"."syllabus_versions"("tenant_id", "document_id");

ALTER TABLE "academic"."syllabus_versions" ADD CONSTRAINT "syllabus_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "academic"."syllabus_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."syllabus_approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "step_code" TEXT NOT NULL,
    "step_name" TEXT NOT NULL,
    "role_slug" TEXT,
    "approver_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "acted_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "syllabus_approvals_tenant_id_document_id_status_idx" ON "academic"."syllabus_approvals"("tenant_id", "document_id", "status");
CREATE INDEX "syllabus_approvals_tenant_id_role_slug_status_idx" ON "academic"."syllabus_approvals"("tenant_id", "role_slug", "status");

ALTER TABLE "academic"."syllabus_approvals" ADD CONSTRAINT "syllabus_approvals_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "academic"."syllabus_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."syllabus_bookmarks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "syllabus_bookmarks_user_id_document_id_key" ON "academic"."syllabus_bookmarks"("user_id", "document_id");
CREATE INDEX "syllabus_bookmarks_tenant_id_user_id_idx" ON "academic"."syllabus_bookmarks"("tenant_id", "user_id");

ALTER TABLE "academic"."syllabus_bookmarks" ADD CONSTRAINT "syllabus_bookmarks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "academic"."syllabus_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."syllabus_access_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "syllabus_access_logs_tenant_id_document_id_created_at_idx" ON "academic"."syllabus_access_logs"("tenant_id", "document_id", "created_at");
CREATE INDEX "syllabus_access_logs_tenant_id_action_created_at_idx" ON "academic"."syllabus_access_logs"("tenant_id", "action", "created_at");

ALTER TABLE "academic"."syllabus_access_logs" ADD CONSTRAINT "syllabus_access_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "academic"."syllabus_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."syllabus_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "ip_address" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "syllabus_audit_logs_tenant_id_action_created_at_idx" ON "academic"."syllabus_audit_logs"("tenant_id", "action", "created_at");
CREATE INDEX "syllabus_audit_logs_tenant_id_document_id_idx" ON "academic"."syllabus_audit_logs"("tenant_id", "document_id");

ALTER TABLE "academic"."syllabus_audit_logs" ADD CONSTRAINT "syllabus_audit_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "academic"."syllabus_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
