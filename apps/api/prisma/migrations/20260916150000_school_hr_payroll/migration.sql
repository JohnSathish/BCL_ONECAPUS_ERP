-- School SIS HR & Payroll (schema school). Isolated from college payroll tables.

CREATE TABLE IF NOT EXISTS "school"."school_hr_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_code_prefix" TEXT NOT NULL DEFAULT 'EMP',
    "lop_divisor" TEXT NOT NULL DEFAULT 'WORKING',
    "custom_divisor" INTEGER NOT NULL DEFAULT 26,
    "period_mode" TEXT NOT NULL DEFAULT 'FINANCIAL',
    "require_attendance" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_settings_tenant_id_key"
  ON "school"."school_hr_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "head_staff_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_hr_departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_departments_tenant_id_code_key"
  ON "school"."school_hr_departments"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "school_hr_departments_tenant_id_parent_id_idx"
  ON "school"."school_hr_departments"("tenant_id", "parent_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_designations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "job_description" TEXT,
    "salary_min_paise" INTEGER NOT NULL DEFAULT 0,
    "salary_max_paise" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_hr_designations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_designations_tenant_id_code_key"
  ON "school"."school_hr_designations"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "school"."school_hr_employee_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_employee_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_employee_types_tenant_id_code_key"
  ON "school"."school_hr_employee_types"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "school"."school_hr_employments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "employee_type_id" UUID,
    "department_id" UUID,
    "designation_id" UUID,
    "reporting_staff_id" UUID,
    "work_location" TEXT,
    "shift" TEXT,
    "category" TEXT,
    "grade" TEXT,
    "campus" TEXT,
    "probation_start" DATE,
    "probation_end" DATE,
    "confirmation_date" DATE,
    "retirement_date" DATE,
    "contract_start" DATE,
    "contract_end" DATE,
    "pan_masked" TEXT,
    "pan_full" TEXT,
    "aadhaar_status" TEXT,
    "uan" TEXT,
    "pf_number" TEXT,
    "esi_number" TEXT,
    "tax_regime" TEXT,
    "extras_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_employments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_employments_staff_id_key"
  ON "school"."school_hr_employments"("staff_id");
CREATE INDEX IF NOT EXISTS "school_hr_employments_tenant_id_department_id_idx"
  ON "school"."school_hr_employments"("tenant_id", "department_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_bank_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "holder_name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "branch" TEXT,
    "account_last4" TEXT NOT NULL,
    "account_full" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "account_type" TEXT NOT NULL DEFAULT 'SAVINGS',
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_bank_accounts_tenant_id_staff_id_idx"
  ON "school"."school_hr_bank_accounts"("tenant_id", "staff_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "doc_number" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT,
    "remarks" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_hr_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_documents_tenant_id_staff_id_expiry_date_idx"
  ON "school"."school_hr_documents"("tenant_id", "staff_id", "expiry_date");

CREATE TABLE IF NOT EXISTS "school"."school_hr_emergency_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "alt_mobile" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_hr_emergency_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_emergency_contacts_tenant_id_staff_id_idx"
  ON "school"."school_hr_emergency_contacts"("tenant_id", "staff_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_nominees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "dob" DATE,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "contact" TEXT,
    "is_nominee" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_hr_nominees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_nominees_tenant_id_staff_id_idx"
  ON "school"."school_hr_nominees"("tenant_id", "staff_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_leave_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "is_lop" BOOLEAN NOT NULL DEFAULT false,
    "requires_document" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_leave_types_tenant_id_code_key"
  ON "school"."school_hr_leave_types"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "school"."school_hr_leave_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "employee_type_id" UUID,
    "annual_entitlement" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "monthly_accrual" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carry_forward" BOOLEAN NOT NULL DEFAULT false,
    "max_carry_forward" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "encashment_allowed" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "applicable_gender" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_leave_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_leave_policies_tenant_id_leave_type_id_idx"
  ON "school"."school_hr_leave_policies"("tenant_id", "leave_type_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_leave_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "opening" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taken" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_leave_balances_tenant_id_staff_id_leave_type_id_year_key"
  ON "school"."school_hr_leave_balances"("tenant_id", "staff_id", "leave_type_id", "year");

CREATE TABLE IF NOT EXISTS "school"."school_hr_leave_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "days" DECIMAL(6,2) NOT NULL,
    "reason" TEXT,
    "attachment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_by" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_leave_requests_tenant_id_status_from_date_idx"
  ON "school"."school_hr_leave_requests"("tenant_id", "status", "from_date");
CREATE INDEX IF NOT EXISTS "school_hr_leave_requests_tenant_id_staff_id_idx"
  ON "school"."school_hr_leave_requests"("tenant_id", "staff_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_attendance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "remark" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "marked_by" UUID,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_attendance_tenant_id_staff_id_date_key"
  ON "school"."school_hr_attendance"("tenant_id", "staff_id", "date");
CREATE INDEX IF NOT EXISTS "school_hr_attendance_tenant_id_date_status_idx"
  ON "school"."school_hr_attendance"("tenant_id", "date", "status");

CREATE TABLE IF NOT EXISTS "school"."school_hr_salary_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "calc_type" TEXT NOT NULL,
    "formula" TEXT,
    "default_paise" INTEGER NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_salary_components_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_salary_components_tenant_id_code_key"
  ON "school"."school_hr_salary_components"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "school"."school_hr_salary_structures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_hr_salary_structures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_salary_structures_tenant_id_code_key"
  ON "school"."school_hr_salary_structures"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "school"."school_hr_structure_lines" (
    "id" UUID NOT NULL,
    "structure_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "formula" TEXT,
    "amount_paise" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "school_hr_structure_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_structure_lines_structure_id_component_id_key"
  ON "school"."school_hr_structure_lines"("structure_id", "component_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_employee_salaries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "structure_id" UUID NOT NULL,
    "basic_paise" INTEGER NOT NULL,
    "components_json" JSONB NOT NULL DEFAULT '[]',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "remarks" TEXT,
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_hr_employee_salaries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_employee_salaries_tenant_id_staff_id_effective_from_idx"
  ON "school"."school_hr_employee_salaries"("tenant_id", "staff_id", "effective_from");

CREATE TABLE IF NOT EXISTS "school"."school_hr_salary_revisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "previous_paise" INTEGER NOT NULL,
    "new_paise" INTEGER NOT NULL,
    "increment_paise" INTEGER NOT NULL,
    "increment_pct" DECIMAL(8,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "reason" TEXT,
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_hr_salary_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_salary_revisions_tenant_id_staff_id_idx"
  ON "school"."school_hr_salary_revisions"("tenant_id", "staff_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_payroll_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_month" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL DEFAULT 'ALL',
    "department_id" UUID,
    "employee_type_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "settings_snap" JSONB NOT NULL DEFAULT '{}',
    "totals_json" JSONB NOT NULL DEFAULT '{}',
    "calculated_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "finalized_at" TIMESTAMP(3),
    "finalized_by" UUID,
    "locked_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),
    "reverse_reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_payroll_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_payroll_runs_tenant_id_period_month_scope_key_key"
  ON "school"."school_hr_payroll_runs"("tenant_id", "period_month", "scope_key");
CREATE INDEX IF NOT EXISTS "school_hr_payroll_runs_tenant_id_status_idx"
  ON "school"."school_hr_payroll_runs"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_hr_payroll_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "earnings_json" JSONB NOT NULL DEFAULT '[]',
    "deductions_json" JSONB NOT NULL DEFAULT '[]',
    "attendance_snap" JSONB NOT NULL DEFAULT '{}',
    "config_snap" JSONB NOT NULL DEFAULT '{}',
    "gross_paise" INTEGER NOT NULL,
    "deduction_paise" INTEGER NOT NULL,
    "net_paise" INTEGER NOT NULL,
    "employer_paise" INTEGER NOT NULL DEFAULT 0,
    "pay_status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_mode" TEXT,
    "payment_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_by" UUID,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_payroll_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_payroll_lines_run_id_staff_id_key"
  ON "school"."school_hr_payroll_lines"("run_id", "staff_id");
CREATE INDEX IF NOT EXISTS "school_hr_payroll_lines_tenant_id_staff_id_idx"
  ON "school"."school_hr_payroll_lines"("tenant_id", "staff_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_loans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "loan_type" TEXT NOT NULL,
    "principal_paise" INTEGER NOT NULL,
    "interest_bps" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "installment_paise" INTEGER NOT NULL,
    "outstanding_paise" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_loans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_loans_tenant_id_staff_id_status_idx"
  ON "school"."school_hr_loans"("tenant_id", "staff_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_hr_loan_installments" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "period_month" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    CONSTRAINT "school_hr_loan_installments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_hr_loan_installments_loan_id_period_month_key"
  ON "school"."school_hr_loan_installments"("loan_id", "period_month");

CREATE TABLE IF NOT EXISTS "school"."school_hr_reimbursements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "expense_date" DATE NOT NULL,
    "description" TEXT,
    "receipt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reviewed_by" UUID,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_reimbursements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_reimbursements_tenant_id_status_idx"
  ON "school"."school_hr_reimbursements"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_hr_exits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "resignation_date" DATE,
    "last_working_date" DATE,
    "reason" TEXT,
    "notice_days" INTEGER NOT NULL DEFAULT 0,
    "clearance_json" JSONB NOT NULL DEFAULT '{}',
    "settlement_json" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_exits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_exits_tenant_id_staff_id_idx"
  ON "school"."school_hr_exits"("tenant_id", "staff_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_timeline" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_hr_timeline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_timeline_tenant_id_staff_id_created_at_idx"
  ON "school"."school_hr_timeline"("tenant_id", "staff_id", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_hr_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "staff_id" UUID,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_hr_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_audit_logs_tenant_id_created_at_idx"
  ON "school"."school_hr_audit_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "school_hr_audit_logs_tenant_id_staff_id_idx"
  ON "school"."school_hr_audit_logs"("tenant_id", "staff_id");

CREATE TABLE IF NOT EXISTS "school"."school_hr_statutory_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_bps" INTEGER NOT NULL DEFAULT 0,
    "ceiling_paise" INTEGER NOT NULL DEFAULT 0,
    "formula" TEXT,
    "effective_from" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_hr_statutory_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_hr_statutory_rules_tenant_id_code_effective_from_idx"
  ON "school"."school_hr_statutory_rules"("tenant_id", "code", "effective_from");

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_departments"
    ADD CONSTRAINT "school_hr_departments_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "school"."school_hr_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_departments"
    ADD CONSTRAINT "school_hr_departments_head_staff_id_fkey"
    FOREIGN KEY ("head_staff_id") REFERENCES "school"."school_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_designations"
    ADD CONSTRAINT "school_hr_designations_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "school"."school_hr_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_employments"
    ADD CONSTRAINT "school_hr_employments_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_employments"
    ADD CONSTRAINT "school_hr_employments_employee_type_id_fkey"
    FOREIGN KEY ("employee_type_id") REFERENCES "school"."school_hr_employee_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_employments"
    ADD CONSTRAINT "school_hr_employments_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "school"."school_hr_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_employments"
    ADD CONSTRAINT "school_hr_employments_designation_id_fkey"
    FOREIGN KEY ("designation_id") REFERENCES "school"."school_hr_designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_bank_accounts"
    ADD CONSTRAINT "school_hr_bank_accounts_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_documents"
    ADD CONSTRAINT "school_hr_documents_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_emergency_contacts"
    ADD CONSTRAINT "school_hr_emergency_contacts_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_nominees"
    ADD CONSTRAINT "school_hr_nominees_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_leave_policies"
    ADD CONSTRAINT "school_hr_leave_policies_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "school"."school_hr_leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_leave_policies"
    ADD CONSTRAINT "school_hr_leave_policies_employee_type_id_fkey"
    FOREIGN KEY ("employee_type_id") REFERENCES "school"."school_hr_employee_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_leave_balances"
    ADD CONSTRAINT "school_hr_leave_balances_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_leave_balances"
    ADD CONSTRAINT "school_hr_leave_balances_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "school"."school_hr_leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_leave_requests"
    ADD CONSTRAINT "school_hr_leave_requests_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_leave_requests"
    ADD CONSTRAINT "school_hr_leave_requests_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "school"."school_hr_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_attendance"
    ADD CONSTRAINT "school_hr_attendance_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_structure_lines"
    ADD CONSTRAINT "school_hr_structure_lines_structure_id_fkey"
    FOREIGN KEY ("structure_id") REFERENCES "school"."school_hr_salary_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_structure_lines"
    ADD CONSTRAINT "school_hr_structure_lines_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "school"."school_hr_salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_employee_salaries"
    ADD CONSTRAINT "school_hr_employee_salaries_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_employee_salaries"
    ADD CONSTRAINT "school_hr_employee_salaries_structure_id_fkey"
    FOREIGN KEY ("structure_id") REFERENCES "school"."school_hr_salary_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_salary_revisions"
    ADD CONSTRAINT "school_hr_salary_revisions_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_payroll_lines"
    ADD CONSTRAINT "school_hr_payroll_lines_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "school"."school_hr_payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_payroll_lines"
    ADD CONSTRAINT "school_hr_payroll_lines_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_loans"
    ADD CONSTRAINT "school_hr_loans_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_loan_installments"
    ADD CONSTRAINT "school_hr_loan_installments_loan_id_fkey"
    FOREIGN KEY ("loan_id") REFERENCES "school"."school_hr_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_reimbursements"
    ADD CONSTRAINT "school_hr_reimbursements_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_exits"
    ADD CONSTRAINT "school_hr_exits_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "school"."school_hr_timeline"
    ADD CONSTRAINT "school_hr_timeline_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
