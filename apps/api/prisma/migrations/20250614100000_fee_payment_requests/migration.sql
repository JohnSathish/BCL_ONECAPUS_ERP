-- Payment facilitation: dynamic QR / payment links (no cash counter)

ALTER TABLE finance.fee_finance_settings
  ADD COLUMN IF NOT EXISTS cash_collection_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_request_expiry_minutes INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS office_qr_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS finance.fee_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  request_no TEXT NOT NULL,
  student_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'PENDING',
  channel TEXT NOT NULL DEFAULT 'OFFICE_QR',
  demand_ids JSONB NOT NULL DEFAULT '[]',
  fee_items JSONB,
  payment_id UUID,
  provider TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  payment_link_url TEXT,
  qr_image_url TEXT,
  upi_reference TEXT,
  generated_by_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  receipt_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fee_payment_requests_tenant_request_no_key
  ON finance.fee_payment_requests(tenant_id, request_no);
CREATE INDEX IF NOT EXISTS fee_payment_requests_tenant_student_status_idx
  ON finance.fee_payment_requests(tenant_id, student_id, status);
CREATE INDEX IF NOT EXISTS fee_payment_requests_tenant_expires_idx
  ON finance.fee_payment_requests(tenant_id, expires_at);
