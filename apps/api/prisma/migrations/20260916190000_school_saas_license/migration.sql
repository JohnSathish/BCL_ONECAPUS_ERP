CREATE TABLE IF NOT EXISTS platform.school_saas_licenses (
  id UUID PRIMARY KEY,
  license_key TEXT NOT NULL UNIQUE,
  tenant_id UUID,
  institution_code TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  license_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  issued_at TIMESTAMPTZ NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  max_students INTEGER NOT NULL DEFAULT 2000,
  max_staff INTEGER NOT NULL DEFAULT 250,
  max_admin_users INTEGER NOT NULL DEFAULT 50,
  installation_limit INTEGER NOT NULL DEFAULT 3,
  modules_json JSONB NOT NULL DEFAULT '[]',
  grace_days INTEGER NOT NULL DEFAULT 15,
  offline_grace_hours INTEGER NOT NULL DEFAULT 72,
  expired_policy TEXT NOT NULL DEFAULT 'read_only',
  license_version TEXT NOT NULL DEFAULT '1.0',
  token_fingerprint TEXT NOT NULL,
  signed_token TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS school_saas_licenses_tenant_idx ON platform.school_saas_licenses (tenant_id);
CREATE INDEX IF NOT EXISTS school_saas_licenses_code_idx ON platform.school_saas_licenses (institution_code);
CREATE INDEX IF NOT EXISTS school_saas_licenses_status_exp_idx ON platform.school_saas_licenses (status, expires_at);

CREATE TABLE IF NOT EXISTS platform.school_saas_installations (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES platform.school_saas_licenses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  installation_id TEXT NOT NULL,
  hostname TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  admin_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (license_id, installation_id)
);

CREATE INDEX IF NOT EXISTS school_saas_installations_tenant_idx ON platform.school_saas_installations (tenant_id);

CREATE TABLE IF NOT EXISTS platform.school_saas_license_events (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES platform.school_saas_licenses(id) ON DELETE CASCADE,
  tenant_id UUID,
  actor_id UUID,
  event TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  meta_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS school_saas_license_events_lic_idx ON platform.school_saas_license_events (license_id, created_at);
CREATE INDEX IF NOT EXISTS school_saas_license_events_tenant_idx ON platform.school_saas_license_events (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS platform.school_saas_revocations (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES platform.school_saas_licenses(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  revoked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS school_saas_revocations_lic_idx ON platform.school_saas_revocations (license_id);

CREATE TABLE IF NOT EXISTS school.school_license_state (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE,
  license_id UUID,
  license_key TEXT,
  installation_id TEXT NOT NULL,
  signed_token TEXT NOT NULL,
  claims_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_validated_at TIMESTAMPTZ,
  next_validation_at TIMESTAMPTZ,
  last_server_error TEXT,
  activated_at TIMESTAMPTZ,
  activated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_license_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  state_id UUID NOT NULL REFERENCES school.school_license_state(id) ON DELETE CASCADE,
  actor_id UUID,
  event TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  meta_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS school_license_events_tenant_idx ON school.school_license_events (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS school.school_license_validations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  state_id UUID NOT NULL REFERENCES school.school_license_state(id) ON DELETE CASCADE,
  ok BOOLEAN NOT NULL,
  source TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS school_license_validations_tenant_idx ON school.school_license_validations (tenant_id, created_at);
