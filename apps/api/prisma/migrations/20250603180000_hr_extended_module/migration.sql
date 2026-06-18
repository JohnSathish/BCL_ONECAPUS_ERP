-- HR Extended Module: leave, recruitment, appraisal, pension, NPS

ALTER TABLE "academic"."staff_profiles" ADD COLUMN IF NOT EXISTS "nps_pran" TEXT;

ALTER TABLE "finance"."payroll_settings" ADD COLUMN IF NOT EXISTS "default_nps_rate" DECIMAL(5,2);

CREATE TABLE IF NOT EXISTS "academic"."staff_leave_balances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE,
  "leave_type_id" UUID NOT NULL,
  "year" INT NOT NULL,
  "allocated_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "used_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "carried_forward" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "staff_profile_id", "leave_type_id", "year")
);

CREATE TABLE IF NOT EXISTS "academic"."staff_leave_applications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE,
  "leave_type_id" UUID NOT NULL,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "total_days" DECIMAL(6,2) NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approval_stage" INT NOT NULL DEFAULT 0,
  "attachment_url" TEXT,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMPTZ,
  "rejection_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "staff_leave_applications_tenant_staff_idx" ON "academic"."staff_leave_applications" ("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "staff_leave_applications_tenant_status_idx" ON "academic"."staff_leave_applications" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."recruitment_vacancies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "department_id" UUID,
  "designation_id" UUID,
  "staff_type" TEXT,
  "vacancies_count" INT NOT NULL DEFAULT 1,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMPTZ,
  "closing_date" DATE,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "recruitment_vacancies_tenant_status_idx" ON "academic"."recruitment_vacancies" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."recruitment_applications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "vacancy_id" UUID NOT NULL REFERENCES "academic"."recruitment_vacancies"("id") ON DELETE CASCADE,
  "full_name" TEXT NOT NULL,
  "email" TEXT,
  "mobile" TEXT,
  "resume_url" TEXT,
  "qualification" TEXT,
  "experience_years" INT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "notes" TEXT,
  "hired_staff_profile_id" UUID REFERENCES "academic"."staff_profiles"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academic"."recruitment_interviews" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL REFERENCES "academic"."recruitment_applications"("id") ON DELETE CASCADE,
  "scheduled_at" TIMESTAMPTZ NOT NULL,
  "venue" TEXT,
  "panel_json" JSONB,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "score" DECIMAL(5,2),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academic"."recruitment_offers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "application_id" UUID NOT NULL REFERENCES "academic"."recruitment_applications"("id") ON DELETE CASCADE,
  "offered_salary" DECIMAL(12,2),
  "joining_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sent_at" TIMESTAMPTZ,
  "accepted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academic"."appraisal_cycles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "year" INT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "template_json" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "academic"."staff_appraisals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "cycle_id" UUID NOT NULL REFERENCES "academic"."appraisal_cycles"("id") ON DELETE CASCADE,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE,
  "self_score" DECIMAL(5,2),
  "hod_score" DECIMAL(5,2),
  "principal_score" DECIMAL(5,2),
  "final_score" DECIMAL(5,2),
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "kpi_snapshot" JSONB,
  "remarks" TEXT,
  "submitted_at" TIMESTAMPTZ,
  "finalized_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "cycle_id", "staff_profile_id")
);

CREATE TABLE IF NOT EXISTS "finance"."staff_pension_enrollments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE,
  "scheme_type" TEXT NOT NULL,
  "enrollment_date" DATE NOT NULL,
  "last_drawn_basic" DECIMAL(12,2),
  "family_pension_eligible" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "staff_profile_id", "scheme_type")
);

CREATE TABLE IF NOT EXISTS "finance"."pension_ledger_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE,
  "month" INT NOT NULL,
  "year" INT NOT NULL,
  "accrual_amount" DECIMAL(12,2) NOT NULL,
  "employer_share" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "employee_share" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
