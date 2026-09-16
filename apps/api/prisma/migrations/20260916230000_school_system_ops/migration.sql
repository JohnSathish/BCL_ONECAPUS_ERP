CREATE TABLE IF NOT EXISTS school.school_sys_settings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  currency TEXT NOT NULL DEFAULT 'INR',
  language TEXT NOT NULL DEFAULT 'en',
  academic_year_label TEXT,
  page_size INTEGER NOT NULL DEFAULT 25,
  session_timeout_min INTEGER NOT NULL DEFAULT 15,
  password_min_length INTEGER NOT NULL DEFAULT 8,
  password_require_mfa BOOLEAN NOT NULL DEFAULT FALSE,
  login_attempt_limit INTEGER NOT NULL DEFAULT 5,
  upload_max_mb INTEGER NOT NULL DEFAULT 10,
  allowed_file_types TEXT NOT NULL DEFAULT 'pdf,jpg,jpeg,png,webp,xlsx,docx',
  notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  notify_sms BOOLEAN NOT NULL DEFAULT TRUE,
  notify_push BOOLEAN NOT NULL DEFAULT TRUE,
  audit_retention_days INTEGER NOT NULL DEFAULT 365,
  log_retention_days INTEGER NOT NULL DEFAULT 90,
  backup_retention_days INTEGER NOT NULL DEFAULT 30,
  backup_keep_count INTEGER NOT NULL DEFAULT 14,
  backup_schedule TEXT NOT NULL DEFAULT 'DAILY',
  backup_hour INTEGER NOT NULL DEFAULT 2,
  backup_minute INTEGER NOT NULL DEFAULT 0,
  backup_database BOOLEAN NOT NULL DEFAULT TRUE,
  backup_uploads BOOLEAN NOT NULL DEFAULT TRUE,
  storage_warn_pct INTEGER NOT NULL DEFAULT 80,
  storage_crit_pct INTEGER NOT NULL DEFAULT 90,
  maintenance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT,
  maintenance_start TIMESTAMPTZ,
  maintenance_end TIMESTAMPTZ,
  maintenance_allow_admin_bypass BOOLEAN NOT NULL DEFAULT TRUE,
  extras_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_sys_backups (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  file_key TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  created_by UUID NOT NULL,
  error TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS school_sys_backups_tenant_created_idx
  ON school.school_sys_backups (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school.school_sys_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  level TEXT NOT NULL,
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  request_id TEXT,
  user_id UUID,
  ip TEXT,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_sys_logs_tenant_created_idx
  ON school.school_sys_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS school_sys_logs_tenant_level_module_idx
  ON school.school_sys_logs (tenant_id, level, module);

CREATE TABLE IF NOT EXISTS school.school_sys_audits (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  ip TEXT,
  user_agent TEXT,
  request_id TEXT,
  before_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_sys_audits_tenant_created_idx
  ON school.school_sys_audits (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS school_sys_audits_tenant_action_idx
  ON school.school_sys_audits (tenant_id, action);
