-- Payroll Phase 4: TDS slabs, payslip email tracking

ALTER TABLE "finance"."payroll_settings"
  ADD COLUMN IF NOT EXISTS "tds_slabs" JSONB;

ALTER TABLE "finance"."payslips"
  ADD COLUMN IF NOT EXISTS "email_sent_at" TIMESTAMPTZ;
