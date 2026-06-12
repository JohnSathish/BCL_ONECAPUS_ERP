-- LMS Phase 3: Quizzes

CREATE TABLE "academic"."lms_quizzes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "time_limit_minutes" INTEGER,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "max_marks" DECIMAL(8,2),
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "due_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lms_quizzes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."lms_quiz_questions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "question_type" TEXT NOT NULL DEFAULT 'MCQ',
    "options" JSONB NOT NULL DEFAULT '[]',
    "correct_answer" TEXT,
    "marks" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lms_quiz_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."lms_quiz_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DECIMAL(8,2),
    "max_score" DECIMAL(8,2),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "lms_quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."lms_quiz_answers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer" TEXT,
    "is_correct" BOOLEAN,
    "marks_awarded" DECIMAL(8,2),

    CONSTRAINT "lms_quiz_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lms_quizzes_tenant_id_workspace_id_status_idx" ON "academic"."lms_quizzes"("tenant_id", "workspace_id", "status");
CREATE INDEX "lms_quiz_questions_tenant_id_quiz_id_sort_order_idx" ON "academic"."lms_quiz_questions"("tenant_id", "quiz_id", "sort_order");
CREATE INDEX "lms_quiz_attempts_tenant_id_quiz_id_status_idx" ON "academic"."lms_quiz_attempts"("tenant_id", "quiz_id", "status");
CREATE INDEX "lms_quiz_attempts_tenant_id_student_id_idx" ON "academic"."lms_quiz_attempts"("tenant_id", "student_id");
CREATE UNIQUE INDEX "lms_quiz_attempts_quiz_id_student_id_attempt_no_key" ON "academic"."lms_quiz_attempts"("quiz_id", "student_id", "attempt_no");
CREATE INDEX "lms_quiz_answers_tenant_id_attempt_id_idx" ON "academic"."lms_quiz_answers"("tenant_id", "attempt_id");
CREATE UNIQUE INDEX "lms_quiz_answers_attempt_id_question_id_key" ON "academic"."lms_quiz_answers"("attempt_id", "question_id");

ALTER TABLE "academic"."lms_quizzes" ADD CONSTRAINT "lms_quizzes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "academic"."lms_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_quizzes" ADD CONSTRAINT "lms_quizzes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_quiz_questions" ADD CONSTRAINT "lms_quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "academic"."lms_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_quiz_attempts" ADD CONSTRAINT "lms_quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "academic"."lms_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_quiz_attempts" ADD CONSTRAINT "lms_quiz_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."lms_quiz_answers" ADD CONSTRAINT "lms_quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "academic"."lms_quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
