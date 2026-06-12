CREATE TABLE "academic"."exam_mark_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "internal_marks" DECIMAL(6,2),
    "external_marks" DECIMAL(6,2),
    "practical_marks" DECIMAL(6,2),
    "grace_marks" DECIMAL(6,2),
    "total_marks" DECIMAL(6,2),
    "max_marks" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "grade" TEXT,
    "grade_point" DECIMAL(4,2),
    "result_status" TEXT NOT NULL DEFAULT 'PENDING',
    "entry_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "entered_by_id" UUID,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exam_mark_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."exam_result_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "total_marks" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "max_marks" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgpa" DECIMAL(4,2),
    "cgpa" DECIMAL(4,2),
    "result_status" TEXT NOT NULL DEFAULT 'PENDING',
    "publish_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "calculated_at" TIMESTAMP(3),
    "remarks" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exam_result_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_mark_entries_paper_id_student_id_key" ON "academic"."exam_mark_entries"("paper_id", "student_id");
CREATE INDEX "exam_mark_entries_tenant_id_session_id_idx" ON "academic"."exam_mark_entries"("tenant_id", "session_id");
CREATE INDEX "exam_mark_entries_student_id_idx" ON "academic"."exam_mark_entries"("student_id");

CREATE UNIQUE INDEX "exam_result_summaries_session_id_student_id_key" ON "academic"."exam_result_summaries"("session_id", "student_id");
CREATE INDEX "exam_result_summaries_tenant_id_session_id_idx" ON "academic"."exam_result_summaries"("tenant_id", "session_id");
CREATE INDEX "exam_result_summaries_student_id_idx" ON "academic"."exam_result_summaries"("student_id");

INSERT INTO "platform"."permissions" ("id", "slug", "resource", "action", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'exam:marks', 'exam', 'marks', 'Enter, verify, and manage examination marks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exam:results', 'exam', 'results', 'Calculate and publish examination results', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
