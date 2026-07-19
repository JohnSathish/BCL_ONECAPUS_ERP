-- Authorized Fee Collection Centers (Net Café / CSC portal)
CREATE TABLE IF NOT EXISTS finance.fee_collection_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  gst_number TEXT,
  pan_number TEXT,
  aadhaar_number TEXT,
  mobile_number TEXT NOT NULL,
  email TEXT NOT NULL,
  address_line TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  email_verified_at TIMESTAMPTZ,
  mobile_verified_at TIMESTAMPTZ,
  email_verify_token_hash TEXT,
  otp_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  rejected_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by_id UUID,
  suspended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fee_collection_centers_tenant_status_idx
  ON finance.fee_collection_centers (tenant_id, status);
CREATE INDEX IF NOT EXISTS fee_collection_centers_tenant_email_idx
  ON finance.fee_collection_centers (tenant_id, email);

CREATE TABLE IF NOT EXISTS finance.fee_collection_center_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  center_id UUID NOT NULL REFERENCES finance.fee_collection_centers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS fee_collection_center_operators_center_idx
  ON finance.fee_collection_center_operators (tenant_id, center_id);

CREATE TABLE IF NOT EXISTS finance.fee_collection_center_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  center_id UUID NOT NULL REFERENCES finance.fee_collection_centers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fee_collection_center_documents_center_idx
  ON finance.fee_collection_center_documents (tenant_id, center_id);

CREATE TABLE IF NOT EXISTS finance.fee_collection_center_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  center_id UUID REFERENCES finance.fee_collection_centers(id) ON DELETE SET NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fee_collection_center_audit_center_idx
  ON finance.fee_collection_center_audit_logs (tenant_id, center_id, created_at);
CREATE INDEX IF NOT EXISTS fee_collection_center_audit_action_idx
  ON finance.fee_collection_center_audit_logs (tenant_id, action, created_at);
