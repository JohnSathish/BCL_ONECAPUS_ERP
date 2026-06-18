-- LMS Phase 2: Assignments

CREATE TABLE "academic"."lms_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "submission_type" TEXT NOT NULL,
    "max_marks" DECIMAL(8,2),
    "due_at" TIMESTAMP(3),
    "allow_late_submission" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lms_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."lms_assignment_submissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "text_content" TEXT,
    "link_url" TEXT,
    "file_path" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lms_assignment_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."lms_assignment_feedback" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "marks_awarded" DECIMAL(8,2),
    "feedback_text" TEXT,
    "evaluated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lms_assignment_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lms_assignments_tenant_id_workspace_id_status_idx" ON "academic"."lms_assignments"("tenant_id", "workspace_id", "status");
CREATE INDEX "lms_assignments_tenant_id_due_at_idx" ON "academic"."lms_assignments"("tenant_id", "due_at");
CREATE INDEX "lms_assignment_submissions_tenant_id_assignment_id_status_idx" ON "academic"."lms_assignment_submissions"("tenant_id", "assignment_id", "status");
CREATE INDEX "lms_assignment_submissions_tenant_id_student_id_idx" ON "academic"."lms_assignment_submissions"("tenant_id", "student_id");
CREATE UNIQUE INDEX "lms_assignment_submissions_assignment_id_student_id_key" ON "academic"."lms_assignment_submissions"("assignment_id", "student_id");
CREATE INDEX "lms_assignment_feedback_tenant_id_submission_id_created_at_idx" ON "academic"."lms_assignment_feedback"("tenant_id", "submission_id", "created_at");

ALTER TABLE "academic"."lms_assignments" ADD CONSTRAINT "lms_assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "academic"."lms_assignment_submissions" ADD CONSTRAINT "lms_assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "academic"."lms_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_assignment_submissions" ADD CONSTRAINT "lms_assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."lms_assignment_feedback" ADD CONSTRAINT "lms_assignment_feedback_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "academic"."lms_assignment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_assignment_feedback" ADD CONSTRAINT "lms_assignment_feedback_evaluated_by_id_fkey" FOREIGN KEY ("evaluated_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
