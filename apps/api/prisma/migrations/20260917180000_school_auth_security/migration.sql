CREATE TABLE IF NOT EXISTS school.school_auth_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  max_login_attempts INTEGER NOT NULL DEFAULT 5,
  lock_minutes INTEGER NOT NULL DEFAULT 15,
  otp_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  otp_resend_seconds INTEGER NOT NULL DEFAULT 45,
  max_otp_attempts INTEGER NOT NULL DEFAULT 5,
  max_otp_sends_per_hour INTEGER NOT NULL DEFAULT 5,
  activation_code_hours INTEGER NOT NULL DEFAULT 72,
  password_min_length INTEGER NOT NULL DEFAULT 8,
  history_count INTEGER NOT NULL DEFAULT 3,
  max_sessions INTEGER NOT NULL DEFAULT 8,
  otp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  activation_code_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  require_verified_contact BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  channel TEXT NOT NULL,
  identifier TEXT NOT NULL,
  contact_masked TEXT,
  contact_kind TEXT,
  otp_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_sent_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  otp_send_count INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_auth_challenges_tenant_purpose_idx
  ON school.school_auth_challenges (tenant_id, purpose, created_at);
CREATE INDEX IF NOT EXISTS school_auth_challenges_tenant_user_idx
  ON school.school_auth_challenges (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS school.school_activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  student_id UUID,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  issued_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_activation_codes_tenant_user_idx
  ON school.school_activation_codes (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS school_activation_codes_tenant_hash_idx
  ON school.school_activation_codes (tenant_id, code_hash);

CREATE TABLE IF NOT EXISTS school.school_auth_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  identifier TEXT NOT NULL,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS school_auth_locks_identifier_idx
  ON school.school_auth_locks (tenant_id, identifier);

CREATE TABLE IF NOT EXISTS school.school_auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  event TEXT NOT NULL,
  identifier TEXT,
  device TEXT,
  ip_address TEXT,
  reason TEXT,
  session_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_auth_events_tenant_created_idx
  ON school.school_auth_events (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS school_auth_events_tenant_user_idx
  ON school.school_auth_events (tenant_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS school_auth_events_tenant_event_idx
  ON school.school_auth_events (tenant_id, event);
