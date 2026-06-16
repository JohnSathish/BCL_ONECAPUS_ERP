-- Database Backup & Disaster Recovery module (platform schema)

CREATE TABLE IF NOT EXISTS platform.backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES platform.tenants(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'DAILY',
  cron_expression TEXT,
  backup_type TEXT NOT NULL DEFAULT 'DATABASE_DOCUMENTS',
  enabled BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backup_schedules_enabled_next_run_at_idx
  ON platform.backup_schedules (enabled, next_run_at);

CREATE TABLE IF NOT EXISTS platform.backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'INSTANCE',
  tenant_id UUID REFERENCES platform.tenants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  triggered_by TEXT NOT NULL,
  triggered_by_user_id UUID,
  safety_for_run_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  error_message TEXT,
  progress_step TEXT,
  job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backup_runs_status_created_at_idx
  ON platform.backup_runs (status, created_at);
CREATE INDEX IF NOT EXISTS backup_runs_tenant_id_created_at_idx
  ON platform.backup_runs (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS platform.backup_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES platform.backup_runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  local_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 TEXT,
  verified_at TIMESTAMPTZ,
  cloud_status TEXT NOT NULL DEFAULT 'PENDING',
  cloud_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backup_artifacts_run_id_idx
  ON platform.backup_artifacts (run_id);

CREATE TABLE IF NOT EXISTS platform.backup_cloud_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  bucket TEXT NOT NULL,
  region TEXT,
  endpoint TEXT,
  path_prefix TEXT NOT NULL DEFAULT 'nep-backups',
  credentials_encrypted TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider)
);

CREATE TABLE IF NOT EXISTS platform.backup_retention_policies (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  keep_count INT,
  keep_days INT NOT NULL DEFAULT 30,
  auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.backup_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID,
  ip_address TEXT,
  run_id UUID REFERENCES platform.backup_runs(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backup_audit_logs_created_at_idx
  ON platform.backup_audit_logs (created_at);
CREATE INDEX IF NOT EXISTS backup_audit_logs_run_id_idx
  ON platform.backup_audit_logs (run_id);

CREATE TABLE IF NOT EXISTS platform.system_maintenance_flags (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  active BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  started_at TIMESTAMPTZ,
  started_by_user_id UUID,
  backup_run_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform.backup_retention_policies (id, keep_days, auto_cleanup_enabled)
VALUES ('singleton', 30, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform.system_maintenance_flags (id, active)
VALUES ('singleton', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform.backup_schedules (frequency, backup_type, enabled, next_run_at)
SELECT 'DAILY', 'DATABASE_DOCUMENTS', true,
  date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day' + interval '2 hours'
WHERE NOT EXISTS (SELECT 1 FROM platform.backup_schedules WHERE tenant_id IS NULL);

INSERT INTO platform.backup_cloud_targets (provider, bucket, enabled)
VALUES ('AWS_S3', '', false)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO platform.backup_cloud_targets (provider, bucket, enabled)
VALUES ('BACKBLAZE_B2', '', false)
ON CONFLICT (provider) DO NOTHING;
