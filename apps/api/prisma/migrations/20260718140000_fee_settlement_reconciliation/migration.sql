-- Fee Settlement Reconciliation Phase 1

ALTER TABLE finance.payment_transactions
  ADD COLUMN IF NOT EXISTS recon_status TEXT NOT NULL DEFAULT 'UNRECONCILED';

CREATE INDEX IF NOT EXISTS payment_transactions_tenant_provider_payment_id_idx
  ON finance.payment_transactions (tenant_id, provider_payment_id);

CREATE INDEX IF NOT EXISTS payment_transactions_tenant_external_reference_idx
  ON finance.payment_transactions (tenant_id, external_reference);

CREATE INDEX IF NOT EXISTS payment_transactions_tenant_recon_status_idx
  ON finance.payment_transactions (tenant_id, recon_status);

CREATE TABLE IF NOT EXISTS finance.fee_settlement_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'GENERIC',
  file_name TEXT,
  settlement_date DATE,
  status TEXT NOT NULL DEFAULT 'IMPORTED',
  row_count INT NOT NULL DEFAULT 0,
  matched_count INT NOT NULL DEFAULT 0,
  exception_count INT NOT NULL DEFAULT 0,
  reconciled_count INT NOT NULL DEFAULT 0,
  imported_by_id UUID,
  remarks TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fee_settlement_batches_tenant_created_idx
  ON finance.fee_settlement_batches (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS fee_settlement_batches_tenant_provider_status_idx
  ON finance.fee_settlement_batches (tenant_id, provider, status);

CREATE TABLE IF NOT EXISTS finance.fee_settlement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES finance.fee_settlement_batches(id) ON DELETE CASCADE,
  line_no INT NOT NULL DEFAULT 0,
  gateway_transaction_id TEXT,
  gateway_payment_id TEXT,
  gateway_order_id TEXT,
  utr TEXT,
  receipt_no TEXT,
  student_identifier TEXT,
  gross_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  fee_charges DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  settlement_date DATE,
  currency TEXT NOT NULL DEFAULT 'INR',
  match_status TEXT NOT NULL DEFAULT 'PENDING',
  match_method TEXT,
  payment_id UUID REFERENCES finance.payment_transactions(id) ON DELETE SET NULL,
  receipt_id UUID,
  amount_difference DECIMAL(12, 2),
  remarks TEXT,
  reviewed_by_id UUID,
  reviewed_at TIMESTAMPTZ,
  raw_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fee_settlement_lines_tenant_batch_status_idx
  ON finance.fee_settlement_lines (tenant_id, batch_id, match_status);

CREATE INDEX IF NOT EXISTS fee_settlement_lines_tenant_payment_idx
  ON finance.fee_settlement_lines (tenant_id, payment_id);

CREATE INDEX IF NOT EXISTS fee_settlement_lines_tenant_gateway_payment_idx
  ON finance.fee_settlement_lines (tenant_id, gateway_payment_id);

CREATE INDEX IF NOT EXISTS fee_settlement_lines_tenant_gateway_order_idx
  ON finance.fee_settlement_lines (tenant_id, gateway_order_id);

CREATE INDEX IF NOT EXISTS fee_settlement_lines_tenant_utr_idx
  ON finance.fee_settlement_lines (tenant_id, utr);

CREATE INDEX IF NOT EXISTS fee_settlement_lines_tenant_receipt_idx
  ON finance.fee_settlement_lines (tenant_id, receipt_no);
