-- Loan repayment receipt management

ALTER TABLE "finance"."staff_loan_transactions"
  ADD COLUMN IF NOT EXISTS "transaction_reference" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "recovered_before" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "recovered_after" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "outstanding_after" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "receipt_generated_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancelled_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

ALTER TABLE "finance"."staff_loans"
  ADD COLUMN IF NOT EXISTS "closure_certificate_url" TEXT;

CREATE INDEX IF NOT EXISTS "staff_loan_transactions_receipt_idx"
  ON "finance"."staff_loan_transactions" ("tenant_id", "receipt_number")
  WHERE "receipt_number" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "staff_loan_transactions_status_idx"
  ON "finance"."staff_loan_transactions" ("tenant_id", "status", "payment_date");
