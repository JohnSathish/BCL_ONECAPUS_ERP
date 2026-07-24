-- Public fee pay portal audit log (pay.donboscocollege.ac.in)
CREATE TABLE IF NOT EXISTS finance.public_fee_pay_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  action TEXT NOT NULL,
  student_id UUID,
  payment_id UUID,
  identifier_hash TEXT,
  outcome TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_fee_pay_audit_logs_tenant_action_created_idx
  ON finance.public_fee_pay_audit_logs (tenant_id, action, created_at);

CREATE INDEX IF NOT EXISTS public_fee_pay_audit_logs_tenant_student_created_idx
  ON finance.public_fee_pay_audit_logs (tenant_id, student_id, created_at);
