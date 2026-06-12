-- Enterprise HRMS & Payroll Module (finance schema)

CREATE TABLE IF NOT EXISTS "finance"."payroll_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "logo_url" TEXT,
    "payslip_footer" TEXT,
    "default_pf_rate" DECIMAL(5,2),
    "default_cpf_rate" DECIMAL(5,2),
    "professional_tax_slabs" JSONB,
    "qr_verify_base_url" TEXT,
    "export_layouts" JSONB,
    "bank_file_formats" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_settings_tenant_id_key" ON "finance"."payroll_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "finance"."pay_salary_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "component_type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "is_statutory" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pay_salary_components_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pay_salary_components_tenant_id_code_key" ON "finance"."pay_salary_components"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "pay_salary_components_tenant_id_component_type_idx" ON "finance"."pay_salary_components"("tenant_id", "component_type");

CREATE TABLE IF NOT EXISTS "finance"."pay_structure_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "structure_type" TEXT NOT NULL,
    "pay_scale_types" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effective_from" DATE,
    "effective_to" DATE,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pay_structure_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pay_structure_templates_tenant_id_code_version_key" ON "finance"."pay_structure_templates"("tenant_id", "code", "version");
CREATE INDEX IF NOT EXISTS "pay_structure_templates_tenant_id_structure_type_idx" ON "finance"."pay_structure_templates"("tenant_id", "structure_type");

CREATE TABLE IF NOT EXISTS "finance"."pay_structure_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pay_structure_template_id" UUID NOT NULL,
    "pay_salary_component_id" UUID NOT NULL,
    "formula_json" JSONB NOT NULL,
    "fixed_override" DECIMAL(12,2),
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pay_structure_components_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pay_structure_components_pay_structure_template_id_pay_salary_component_id_key" ON "finance"."pay_structure_components"("pay_structure_template_id", "pay_salary_component_id");
CREATE INDEX IF NOT EXISTS "pay_structure_components_tenant_id_idx" ON "finance"."pay_structure_components"("tenant_id");
ALTER TABLE "finance"."pay_structure_components" ADD CONSTRAINT "pay_structure_components_pay_structure_template_id_fkey" FOREIGN KEY ("pay_structure_template_id") REFERENCES "finance"."pay_structure_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."pay_structure_components" ADD CONSTRAINT "pay_structure_components_pay_salary_component_id_fkey" FOREIGN KEY ("pay_salary_component_id") REFERENCES "finance"."pay_salary_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."staff_pay_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "pay_structure_template_id" UUID NOT NULL,
    "pay_scale_type" TEXT NOT NULL,
    "basic_pay" DECIMAL(12,2) NOT NULL,
    "component_overrides" JSONB,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_pay_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "staff_pay_assignments_tenant_id_staff_profile_id_idx" ON "finance"."staff_pay_assignments"("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "staff_pay_assignments_tenant_id_pay_scale_type_idx" ON "finance"."staff_pay_assignments"("tenant_id", "pay_scale_type");
CREATE INDEX IF NOT EXISTS "staff_pay_assignments_tenant_id_effective_from_idx" ON "finance"."staff_pay_assignments"("tenant_id", "effective_from");
ALTER TABLE "finance"."staff_pay_assignments" ADD CONSTRAINT "staff_pay_assignments_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."staff_pay_assignments" ADD CONSTRAINT "staff_pay_assignments_pay_structure_template_id_fkey" FOREIGN KEY ("pay_structure_template_id") REFERENCES "finance"."pay_structure_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."payroll_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pay_structure_template_id" UUID,
    "pay_scale_type" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "prepared_by_id" UUID,
    "verified_by_id" UUID,
    "approved_by_id" UUID,
    "published_by_id" UUID,
    "prepared_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_tenant_id_month_year_pay_scale_type_key" ON "finance"."payroll_runs"("tenant_id", "month", "year", "pay_scale_type");
CREATE INDEX IF NOT EXISTS "payroll_runs_tenant_id_status_idx" ON "finance"."payroll_runs"("tenant_id", "status");
ALTER TABLE "finance"."payroll_runs" ADD CONSTRAINT "payroll_runs_pay_structure_template_id_fkey" FOREIGN KEY ("pay_structure_template_id") REFERENCES "finance"."pay_structure_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."salary_revisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_pay_assignment_id" UUID NOT NULL,
    "revision_type" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "applied_at" TIMESTAMP(3),
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "payroll_run_id" UUID,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_revisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "salary_revisions_tenant_id_effective_from_idx" ON "finance"."salary_revisions"("tenant_id", "effective_from");
ALTER TABLE "finance"."salary_revisions" ADD CONSTRAINT "salary_revisions_staff_pay_assignment_id_fkey" FOREIGN KEY ("staff_pay_assignment_id") REFERENCES "finance"."staff_pay_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."salary_revisions" ADD CONSTRAINT "salary_revisions_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "finance"."payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."increment_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "increment_type" TEXT NOT NULL,
    "increment_value" DECIMAL(12,2) NOT NULL,
    "filter_json" JSONB,
    "effective_from" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "applied_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "increment_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "increment_batches_tenant_id_status_idx" ON "finance"."increment_batches"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "finance"."increment_batch_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "increment_batch_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "previous_basic_pay" DECIMAL(12,2) NOT NULL,
    "new_basic_pay" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "increment_batch_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "increment_batch_lines_increment_batch_id_idx" ON "finance"."increment_batch_lines"("increment_batch_id");
ALTER TABLE "finance"."increment_batch_lines" ADD CONSTRAINT "increment_batch_lines_increment_batch_id_fkey" FOREIGN KEY ("increment_batch_id") REFERENCES "finance"."increment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."staff_loans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "loan_number" TEXT NOT NULL,
    "loan_type" TEXT NOT NULL,
    "principal_amount" DECIMAL(12,2) NOT NULL,
    "monthly_deduction" DECIMAL(12,2) NOT NULL,
    "balance_amount" DECIMAL(12,2) NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "paid_installments" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_loans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_loans_tenant_id_loan_number_key" ON "finance"."staff_loans"("tenant_id", "loan_number");
CREATE INDEX IF NOT EXISTS "staff_loans_tenant_id_staff_profile_id_idx" ON "finance"."staff_loans"("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "staff_loans_tenant_id_status_idx" ON "finance"."staff_loans"("tenant_id", "status");
ALTER TABLE "finance"."staff_loans" ADD CONSTRAINT "staff_loans_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."payslips" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "pay_scale_type" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "gross_salary" DECIMAL(12,2) NOT NULL,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_salary" DECIMAL(12,2) NOT NULL,
    "working_days" INTEGER,
    "lop_days" INTEGER,
    "proration_factor" DECIMAL(6,4),
    "attendance_summary" JSONB,
    "verify_token" TEXT,
    "pdf_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payslips_payroll_run_id_staff_profile_id_key" ON "finance"."payslips"("payroll_run_id", "staff_profile_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payslips_verify_token_key" ON "finance"."payslips"("verify_token");
CREATE INDEX IF NOT EXISTS "payslips_tenant_id_staff_profile_id_idx" ON "finance"."payslips"("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "payslips_tenant_id_year_month_idx" ON "finance"."payslips"("tenant_id", "year", "month");
ALTER TABLE "finance"."payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "finance"."payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."payslips" ADD CONSTRAINT "payslips_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."staff_loan_installments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_loan_id" UUID NOT NULL,
    "payroll_run_id" UUID,
    "payslip_id" UUID,
    "installment_no" INTEGER NOT NULL,
    "scheduled_amount" DECIMAL(12,2) NOT NULL,
    "recovered_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "due_month" INTEGER NOT NULL,
    "due_year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recovered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_loan_installments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "staff_loan_installments_staff_loan_id_idx" ON "finance"."staff_loan_installments"("staff_loan_id");
CREATE INDEX IF NOT EXISTS "staff_loan_installments_tenant_id_due_year_due_month_idx" ON "finance"."staff_loan_installments"("tenant_id", "due_year", "due_month");
ALTER TABLE "finance"."staff_loan_installments" ADD CONSTRAINT "staff_loan_installments_staff_loan_id_fkey" FOREIGN KEY ("staff_loan_id") REFERENCES "finance"."staff_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."staff_loan_installments" ADD CONSTRAINT "staff_loan_installments_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "finance"."payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."staff_loan_installments" ADD CONSTRAINT "staff_loan_installments_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "finance"."payslips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."payslip_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "pay_salary_component_id" UUID,
    "component_code" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "component_type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "formula_trace" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payslip_lines_payslip_id_idx" ON "finance"."payslip_lines"("payslip_id");
ALTER TABLE "finance"."payslip_lines" ADD CONSTRAINT "payslip_lines_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "finance"."payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."payslip_lines" ADD CONSTRAINT "payslip_lines_pay_salary_component_id_fkey" FOREIGN KEY ("pay_salary_component_id") REFERENCES "finance"."pay_salary_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."pf_cpf_ledger_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "contribution_type" TEXT NOT NULL,
    "employee_contribution" DECIMAL(12,2) NOT NULL,
    "employer_contribution" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pf_cpf_ledger_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pf_cpf_ledger_entries_tenant_id_staff_profile_id_year_month_idx" ON "finance"."pf_cpf_ledger_entries"("tenant_id", "staff_profile_id", "year", "month");
ALTER TABLE "finance"."pf_cpf_ledger_entries" ADD CONSTRAINT "pf_cpf_ledger_entries_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "finance"."payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."salary_arrear_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payroll_run_id" UUID,
    "name" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "applied_in_month" INTEGER NOT NULL,
    "applied_in_year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_arrear_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "salary_arrear_batches_tenant_id_status_idx" ON "finance"."salary_arrear_batches"("tenant_id", "status");
ALTER TABLE "finance"."salary_arrear_batches" ADD CONSTRAINT "salary_arrear_batches_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "finance"."payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "finance"."salary_arrear_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "salary_arrear_batch_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "months_count" INTEGER NOT NULL,
    "old_net_salary" DECIMAL(12,2) NOT NULL,
    "new_net_salary" DECIMAL(12,2) NOT NULL,
    "arrear_amount" DECIMAL(12,2) NOT NULL,
    "breakdown" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_arrear_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "salary_arrear_lines_salary_arrear_batch_id_idx" ON "finance"."salary_arrear_lines"("salary_arrear_batch_id");
ALTER TABLE "finance"."salary_arrear_lines" ADD CONSTRAINT "salary_arrear_lines_salary_arrear_batch_id_fkey" FOREIGN KEY ("salary_arrear_batch_id") REFERENCES "finance"."salary_arrear_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
