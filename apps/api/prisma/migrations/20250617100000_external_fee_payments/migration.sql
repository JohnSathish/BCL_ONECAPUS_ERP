-- External fee payment reconciliation (Don Bosco College)
ALTER TABLE finance.payment_transactions
  ADD COLUMN IF NOT EXISTS payment_source VARCHAR(64),
  ADD COLUMN IF NOT EXISTS external_reference VARCHAR(128),
  ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE TABLE IF NOT EXISTS finance.external_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entry_no VARCHAR(32) NOT NULL,
  student_id UUID NOT NULL,
  payment_source VARCHAR(64) NOT NULL,
  external_reference VARCHAR(128),
  transaction_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  remarks TEXT,
  attachment_urls JSONB NOT NULL DEFAULT '[]',
  demand_ids JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  payment_id UUID,
  receipt_id UUID,
  submitted_by_id UUID,
  verified_by_id UUID,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_fee_payments_tenant_entry_no_key UNIQUE (tenant_id, entry_no)
);

CREATE INDEX IF NOT EXISTS external_fee_payments_tenant_student_status_idx
  ON finance.external_fee_payments (tenant_id, student_id, status);
CREATE INDEX IF NOT EXISTS external_fee_payments_tenant_source_status_idx
  ON finance.external_fee_payments (tenant_id, payment_source, status);
CREATE INDEX IF NOT EXISTS external_fee_payments_tenant_txn_date_idx
  ON finance.external_fee_payments (tenant_id, transaction_date);

CREATE INDEX IF NOT EXISTS payment_transactions_tenant_payment_source_idx
  ON finance.payment_transactions (tenant_id, payment_source);
