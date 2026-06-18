-- Student fee summaries + performance indexes for pre-launch

CREATE TABLE IF NOT EXISTS finance.student_fee_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  total_outstanding NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_overdue NUMERIC(12,2) NOT NULL DEFAULT 0,
  admission_outstanding NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_outstanding NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  fee_status TEXT NOT NULL DEFAULT 'CLEAR',
  last_payment_at TIMESTAMPTZ,
  active_demand_count INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS student_fee_summaries_tenant_student_key
  ON finance.student_fee_summaries(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS student_fee_summaries_tenant_outstanding_idx
  ON finance.student_fee_summaries(tenant_id, total_outstanding);
CREATE INDEX IF NOT EXISTS student_fee_summaries_tenant_status_idx
  ON finance.student_fee_summaries(tenant_id, fee_status);

CREATE INDEX IF NOT EXISTS fee_payment_requests_tenant_payment_idx
  ON finance.fee_payment_requests(tenant_id, payment_id);

CREATE INDEX IF NOT EXISTS admission_applications_tenant_payment_ref_idx
  ON academic.admission_applications(tenant_id, payment_reference);

CREATE INDEX IF NOT EXISTS admission_applications_tenant_email_lower_idx
  ON academic.admission_applications(tenant_id, lower(email));
