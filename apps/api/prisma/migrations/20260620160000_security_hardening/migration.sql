-- Security hardening: MFA tables, enforced roles, immutable audit logs

ALTER TABLE platform.tenant_security_settings
  ADD COLUMN IF NOT EXISTS mfa_enforced_roles JSONB NOT NULL DEFAULT '["super-admin","principal","accountant","examination-cell"]'::jsonb;

CREATE TABLE IF NOT EXISTS platform.user_mfa_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES platform.users(id) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.user_mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_mfa_recovery_codes_user_id_idx
  ON platform.user_mfa_recovery_codes(user_id);

CREATE OR REPLACE FUNCTION platform.prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable ON platform.audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON platform.audit_logs
  FOR EACH ROW EXECUTE FUNCTION platform.prevent_audit_log_mutation();
