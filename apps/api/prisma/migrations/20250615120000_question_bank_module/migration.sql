-- Question Bank Phase 1

CREATE TABLE "academic"."question_bank_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "max_upload_mb" INTEGER NOT NULL DEFAULT 25,
    "allowed_mime_types" JSONB NOT NULL DEFAULT '[]',
    "allowed_paper_types" JSONB NOT NULL DEFAULT '[]',
    "student_access_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_bank_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "question_bank_settings_tenant_id_key" ON "academic"."question_bank_settings"("tenant_id");

CREATE TABLE "academic"."question_papers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "paper_code" TEXT NOT NULL,
    "paper_name" TEXT NOT NULL,
    "academic_year_id" UUID,
    "program_version_id" UUID,
    "department_id" UUID,
    "course_id" UUID,
    "semester_no" INTEGER,
    "examination_session" TEXT,
    "paper_type" TEXT NOT NULL,
    "paper_category" TEXT,
    "exam_month" INTEGER,
    "exam_year" INTEGER,
    "duration_minutes" INTEGER,
    "max_marks" INTEGER,
    "file_path" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "preview_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "search_text" TEXT,
    "uploaded_by_id" UUID,
    "published_by_id" UUID,
    "published_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "question_papers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "question_papers_tenant_id_course_id_exam_year_idx" ON "academic"."question_papers"("tenant_id", "course_id", "exam_year");
CREATE INDEX "question_papers_tenant_id_status_idx" ON "academic"."question_papers"("tenant_id", "status");
CREATE INDEX "question_papers_tenant_id_paper_type_idx" ON "academic"."question_papers"("tenant_id", "paper_type");
CREATE INDEX "question_papers_tenant_id_department_id_idx" ON "academic"."question_papers"("tenant_id", "department_id");
CREATE INDEX "question_papers_tenant_id_paper_code_idx" ON "academic"."question_papers"("tenant_id", "paper_code");

CREATE TABLE "academic"."question_paper_approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
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

    CONSTRAINT "question_paper_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "question_paper_approvals_tenant_id_paper_id_status_idx" ON "academic"."question_paper_approvals"("tenant_id", "paper_id", "status");
CREATE INDEX "question_paper_approvals_tenant_id_role_slug_status_idx" ON "academic"."question_paper_approvals"("tenant_id", "role_slug", "status");

ALTER TABLE "academic"."question_paper_approvals" ADD CONSTRAINT "question_paper_approvals_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "academic"."question_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."question_paper_bookmarks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_paper_bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "question_paper_bookmarks_user_id_paper_id_key" ON "academic"."question_paper_bookmarks"("user_id", "paper_id");
CREATE INDEX "question_paper_bookmarks_tenant_id_user_id_idx" ON "academic"."question_paper_bookmarks"("tenant_id", "user_id");

ALTER TABLE "academic"."question_paper_bookmarks" ADD CONSTRAINT "question_paper_bookmarks_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "academic"."question_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."question_paper_access_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_paper_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "question_paper_access_logs_tenant_id_paper_id_created_at_idx" ON "academic"."question_paper_access_logs"("tenant_id", "paper_id", "created_at");
CREATE INDEX "question_paper_access_logs_tenant_id_action_created_at_idx" ON "academic"."question_paper_access_logs"("tenant_id", "action", "created_at");

ALTER TABLE "academic"."question_paper_access_logs" ADD CONSTRAINT "question_paper_access_logs_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "academic"."question_papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."question_bank_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "paper_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "ip_address" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "question_bank_audit_logs_tenant_id_action_created_at_idx" ON "academic"."question_bank_audit_logs"("tenant_id", "action", "created_at");
CREATE INDEX "question_bank_audit_logs_tenant_id_paper_id_idx" ON "academic"."question_bank_audit_logs"("tenant_id", "paper_id");

ALTER TABLE "academic"."question_bank_audit_logs" ADD CONSTRAINT "question_bank_audit_logs_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "academic"."question_papers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
