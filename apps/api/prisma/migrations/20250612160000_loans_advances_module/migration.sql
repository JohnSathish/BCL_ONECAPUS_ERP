-- Enterprise Loans & Advances module

CREATE TABLE IF NOT EXISTS "finance"."loan_type_configs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "max_amount" DECIMAL(12,2),
  "default_installment" DECIMAL(12,2),
  "interest_applicable" BOOLEAN NOT NULL DEFAULT false,
  "interest_rate" DECIMAL(5,2),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INT NOT NULL DEFAULT 100,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "code")
);

ALTER TABLE "finance"."staff_loans"
  ADD COLUMN IF NOT EXISTS "loan_type_config_id" UUID REFERENCES "finance"."loan_type_configs"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "repayment_method" TEXT NOT NULL DEFAULT 'SALARY_DEDUCTION',
  ADD COLUMN IF NOT EXISTS "salary_deduction_amount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "loan_date" DATE,
  ADD COLUMN IF NOT EXISTS "repayment_start_date" DATE,
  ADD COLUMN IF NOT EXISTS "expected_close_date" DATE,
  ADD COLUMN IF NOT EXISTS "total_recovered" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ;

UPDATE "finance"."staff_loans"
SET
  "salary_deduction_amount" = COALESCE("salary_deduction_amount", "monthly_deduction"),
  "loan_date" = COALESCE("loan_date", "start_date"),
  "repayment_start_date" = COALESCE("repayment_start_date", "start_date"),
  "total_recovered" = GREATEST(0, "principal_amount" - "balance_amount")
WHERE "salary_deduction_amount" IS NULL OR "loan_date" IS NULL;

CREATE TABLE IF NOT EXISTS "finance"."staff_loan_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_loan_id" UUID NOT NULL REFERENCES "finance"."staff_loans"("id") ON DELETE CASCADE,
  "transaction_type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "payment_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "receipt_number" TEXT,
  "remarks" TEXT,
  "document_url" TEXT,
  "payroll_run_id" UUID REFERENCES "finance"."payroll_runs"("id") ON DELETE SET NULL,
  "payslip_id" UUID REFERENCES "finance"."payslips"("id") ON DELETE SET NULL,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "staff_loan_transactions_loan_idx" ON "finance"."staff_loan_transactions" ("tenant_id", "staff_loan_id", "payment_date");

CREATE TABLE IF NOT EXISTS "finance"."staff_loan_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_loan_id" UUID NOT NULL REFERENCES "finance"."staff_loans"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "staff_loan_audit_loan_idx" ON "finance"."staff_loan_audit_logs" ("tenant_id", "staff_loan_id", "created_at");

INSERT INTO platform.permissions (id, slug, resource, action, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'loans:read', 'loans', 'read', 'View staff loans and advances', now(), now()),
  (gen_random_uuid(), 'loans:manage', 'loans', 'manage', 'Create loans, record repayments, restructure', now(), now()),
  (gen_random_uuid(), 'loans:reports', 'loans', 'reports', 'Export loan reports', now(), now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.slug IN ('college-admin', 'super-admin', 'institution-admin')
  AND p.slug IN ('loans:read', 'loans:manage', 'loans:reports')
ON CONFLICT DO NOTHING;
