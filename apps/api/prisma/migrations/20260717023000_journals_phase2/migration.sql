-- Journal Platform Phase 2: submissions, review workflow, editorial decisions

CREATE TABLE "academic"."journal_person_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "affiliation" TEXT,
    "orcid" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_person_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."journal_submissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "submitted_by_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "current_round" INTEGER NOT NULL DEFAULT 0,
    "corresponding_email" TEXT,
    "cover_letter" TEXT,
    "submitted_at" TIMESTAMP(3),
    "published_article_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."journal_submission_co_authors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "affiliation" TEXT,
    "orcid" TEXT,
    "is_corresponding" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_submission_co_authors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."journal_submission_files" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MANUSCRIPT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_submission_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."journal_review_rounds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "round_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_review_rounds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."journal_review_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "invited_by_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "invite_token" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_review_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."journal_review_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "recommendation" TEXT NOT NULL,
    "comments_to_editor" TEXT,
    "comments_to_author" TEXT,
    "confidential_notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_review_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."journal_editorial_decisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "round_id" UUID,
    "decision" TEXT NOT NULL,
    "notes_html" TEXT,
    "decided_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_editorial_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "journal_person_profiles_tenant_id_user_id_key" ON "academic"."journal_person_profiles"("tenant_id", "user_id");
CREATE INDEX "journal_person_profiles_tenant_id_email_idx" ON "academic"."journal_person_profiles"("tenant_id", "email");

CREATE INDEX "journal_submissions_tenant_id_journal_id_status_idx" ON "academic"."journal_submissions"("tenant_id", "journal_id", "status");
CREATE INDEX "journal_submissions_submitted_by_user_id_idx" ON "academic"."journal_submissions"("submitted_by_user_id");

CREATE INDEX "journal_submission_co_authors_submission_id_idx" ON "academic"."journal_submission_co_authors"("submission_id");
CREATE INDEX "journal_submission_files_submission_id_kind_idx" ON "academic"."journal_submission_files"("submission_id", "kind");

CREATE UNIQUE INDEX "journal_review_rounds_submission_id_round_number_key" ON "academic"."journal_review_rounds"("submission_id", "round_number");
CREATE INDEX "journal_review_rounds_tenant_id_submission_id_idx" ON "academic"."journal_review_rounds"("tenant_id", "submission_id");

CREATE UNIQUE INDEX "journal_review_assignments_invite_token_key" ON "academic"."journal_review_assignments"("invite_token");
CREATE INDEX "journal_review_assignments_tenant_id_reviewer_user_id_status_idx" ON "academic"."journal_review_assignments"("tenant_id", "reviewer_user_id", "status");
CREATE INDEX "journal_review_assignments_round_id_idx" ON "academic"."journal_review_assignments"("round_id");

CREATE UNIQUE INDEX "journal_review_reports_assignment_id_key" ON "academic"."journal_review_reports"("assignment_id");
CREATE INDEX "journal_editorial_decisions_tenant_id_submission_id_idx" ON "academic"."journal_editorial_decisions"("tenant_id", "submission_id");

ALTER TABLE "academic"."journal_submissions" ADD CONSTRAINT "journal_submissions_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."journal_submission_co_authors" ADD CONSTRAINT "journal_submission_co_authors_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "academic"."journal_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."journal_submission_files" ADD CONSTRAINT "journal_submission_files_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "academic"."journal_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."journal_review_rounds" ADD CONSTRAINT "journal_review_rounds_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "academic"."journal_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."journal_review_assignments" ADD CONSTRAINT "journal_review_assignments_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "academic"."journal_review_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."journal_review_reports" ADD CONSTRAINT "journal_review_reports_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "academic"."journal_review_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."journal_editorial_decisions" ADD CONSTRAINT "journal_editorial_decisions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "academic"."journal_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
