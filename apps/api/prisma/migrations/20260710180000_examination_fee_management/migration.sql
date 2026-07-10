-- Semester Examination Fee Management (V1)

ALTER TABLE "academic"."courses"
  ADD COLUMN IF NOT EXISTS "exam_paper_type" TEXT;

CREATE TABLE IF NOT EXISTS "finance"."exam_fee_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "academic_year_id" UUID,
  "academic_year_label" TEXT,
  "semester_cycle" TEXT NOT NULL,
  "applicable_semesters" JSONB NOT NULL DEFAULT '[]',
  "application_start_date" DATE,
  "application_end_date" DATE,
  "late_fee_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_fee_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exam_fee_sessions_tenant_id_status_idx"
  ON "finance"."exam_fee_sessions"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "exam_fee_sessions_tenant_id_academic_year_id_idx"
  ON "finance"."exam_fee_sessions"("tenant_id", "academic_year_id");

CREATE TABLE IF NOT EXISTS "finance"."exam_fee_masters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "academic_year_id" UUID,
  "academic_year_label" TEXT,
  "effective_from" DATE,
  "effective_to" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_fee_masters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exam_fee_masters_tenant_id_is_active_idx"
  ON "finance"."exam_fee_masters"("tenant_id", "is_active");

CREATE TABLE IF NOT EXISTS "finance"."exam_fee_master_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "master_id" UUID NOT NULL,
  "head_code" TEXT NOT NULL,
  "head_name" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'FLAT',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_fee_master_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_fee_master_lines_master_id_fkey"
    FOREIGN KEY ("master_id") REFERENCES "finance"."exam_fee_masters"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_fee_master_lines_master_id_head_code_key"
  ON "finance"."exam_fee_master_lines"("master_id", "head_code");
CREATE INDEX IF NOT EXISTS "exam_fee_master_lines_tenant_id_master_id_idx"
  ON "finance"."exam_fee_master_lines"("tenant_id", "master_id");

CREATE TABLE IF NOT EXISTS "finance"."exam_fee_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "receipt_prefix" TEXT NOT NULL DEFAULT 'EXAM',
  "allowed_manual_modes" JSONB NOT NULL DEFAULT '["CASH","UPI","BANK_TRANSFER","CHEQUE","DD"]',
  "require_declaration" BOOLEAN NOT NULL DEFAULT true,
  "auto_verify_on_payment" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_fee_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_fee_settings_tenant_id_key"
  ON "finance"."exam_fee_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "finance"."exam_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "application_no" TEXT NOT NULL,
  "current_semester_no" INTEGER NOT NULL,
  "department_id" UUID,
  "department_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "declaration_accepted" BOOLEAN NOT NULL DEFAULT false,
  "declaration_accepted_at" TIMESTAMP(3),
  "current_semester_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "back_paper_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "processing_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "late_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "fee_breakdown" JSONB NOT NULL DEFAULT '{}',
  "demand_id" UUID,
  "submitted_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "verified_at" TIMESTAMP(3),
  "verified_by_id" UUID,
  "remarks" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_applications_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "finance"."exam_fee_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_applications_tenant_id_application_no_key"
  ON "finance"."exam_applications"("tenant_id", "application_no");
CREATE UNIQUE INDEX IF NOT EXISTS "exam_applications_tenant_id_session_id_student_id_key"
  ON "finance"."exam_applications"("tenant_id", "session_id", "student_id");
CREATE INDEX IF NOT EXISTS "exam_applications_tenant_id_status_idx"
  ON "finance"."exam_applications"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "exam_applications_tenant_id_student_id_idx"
  ON "finance"."exam_applications"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "exam_applications_tenant_id_session_id_status_idx"
  ON "finance"."exam_applications"("tenant_id", "session_id", "status");

CREATE TABLE IF NOT EXISTS "finance"."exam_application_current_subjects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "course_id" UUID,
  "subject_code" TEXT NOT NULL,
  "subject_name" TEXT NOT NULL,
  "exam_paper_type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_application_current_subjects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_application_current_subjects_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "finance"."exam_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "exam_application_current_subjects_tenant_id_application_id_idx"
  ON "finance"."exam_application_current_subjects"("tenant_id", "application_id");

CREATE TABLE IF NOT EXISTS "finance"."exam_application_back_papers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "semester_no" INTEGER NOT NULL,
  "subject_code" TEXT NOT NULL,
  "subject_name" TEXT NOT NULL,
  "exam_paper_type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "external_result_ref" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_application_back_papers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_application_back_papers_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "finance"."exam_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "exam_application_back_papers_tenant_id_application_id_idx"
  ON "finance"."exam_application_back_papers"("tenant_id", "application_id");

CREATE TABLE IF NOT EXISTS "finance"."exam_application_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "remarks" TEXT,
  "actor_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_application_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_application_status_history_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "finance"."exam_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "exam_application_status_history_tenant_id_application_id_created_at_idx"
  ON "finance"."exam_application_status_history"("tenant_id", "application_id", "created_at");

CREATE TABLE IF NOT EXISTS "finance"."exam_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "payment_mode" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payment_transaction_id" UUID,
  "provider" TEXT,
  "provider_payment_id" TEXT,
  "external_reference" TEXT,
  "collected_by_id" UUID,
  "paid_at" TIMESTAMP(3),
  "remarks" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_payments_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "finance"."exam_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "exam_payments_tenant_id_application_id_idx"
  ON "finance"."exam_payments"("tenant_id", "application_id");
CREATE INDEX IF NOT EXISTS "exam_payments_tenant_id_status_idx"
  ON "finance"."exam_payments"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "exam_payments_tenant_id_student_id_idx"
  ON "finance"."exam_payments"("tenant_id", "student_id");

CREATE TABLE IF NOT EXISTS "finance"."exam_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "payment_id" UUID,
  "student_id" UUID NOT NULL,
  "receipt_no" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issued_by_id" UUID,
  "pdf_path" TEXT,
  "qr_payload" TEXT,
  "breakdown" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "exam_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_receipts_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "finance"."exam_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exam_receipts_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "finance"."exam_payments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_receipts_tenant_id_receipt_no_key"
  ON "finance"."exam_receipts"("tenant_id", "receipt_no");
CREATE INDEX IF NOT EXISTS "exam_receipts_tenant_id_student_id_issued_at_idx"
  ON "finance"."exam_receipts"("tenant_id", "student_id", "issued_at");
CREATE INDEX IF NOT EXISTS "exam_receipts_tenant_id_application_id_idx"
  ON "finance"."exam_receipts"("tenant_id", "application_id");
