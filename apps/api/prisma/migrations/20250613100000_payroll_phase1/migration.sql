-- Payroll Phase 1: audit log, adjustments, exclusions, paid status

CREATE TABLE IF NOT EXISTS "finance"."payroll_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID,
  "action" TEXT NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "payroll_audit_logs_tenant_idx" ON "finance"."payroll_audit_logs" ("tenant_id", "entity_type", "created_at");

CREATE TABLE IF NOT EXISTS "finance"."payroll_run_staff_exclusions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "payroll_run_id" UUID NOT NULL REFERENCES "finance"."payroll_runs"("id") ON DELETE CASCADE,
  "staff_profile_id" UUID NOT NULL,
  "reason" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("payroll_run_id", "staff_profile_id")
);

CREATE TABLE IF NOT EXISTS "finance"."payslip_adjustments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "payroll_run_id" UUID NOT NULL REFERENCES "finance"."payroll_runs"("id") ON DELETE CASCADE,
  "staff_profile_id" UUID NOT NULL,
  "payslip_id" UUID REFERENCES "finance"."payslips"("id") ON DELETE SET NULL,
  "label" TEXT NOT NULL,
  "adjustment_type" TEXT NOT NULL DEFAULT 'DEDUCTION',
  "amount" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "payslip_adjustments_run_idx" ON "finance"."payslip_adjustments" ("tenant_id", "payroll_run_id");

ALTER TABLE "finance"."payroll_runs"
  ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "paid_by_id" UUID;

ALTER TABLE "finance"."salary_arrear_batches"
  ADD COLUMN IF NOT EXISTS "applied_at" TIMESTAMPTZ;
