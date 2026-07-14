-- Device & Login Management: AccessDevice registry + IpGeoCache + security policy fields

ALTER TABLE platform.tenant_security_settings
  ADD COLUMN IF NOT EXISTS alert_on_new_device boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_on_new_country boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_failed_before_flag int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS block_on_excessive_fails boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_email_on_security boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push_on_security boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_remember_me boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS geo_lookup_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS platform.access_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  client_type text NOT NULL DEFAULT 'WEB',
  device_type text,
  device_name text,
  manufacturer text,
  brand text,
  model text,
  platform text,
  os_version text,
  app_version text,
  browser_name text,
  browser_version text,
  screen_resolution text,
  language text,
  time_zone text,
  last_ip text,
  last_ip_masked text,
  last_city text,
  last_region text,
  last_country text,
  last_isp text,
  status text NOT NULL DEFAULT 'ACTIVE',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  login_count int NOT NULL DEFAULT 0,
  blocked_at timestamptz,
  blocked_by_id uuid,
  block_reason text,
  mobile_device_id uuid REFERENCES platform.mobile_devices(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_devices_tenant_user_fp UNIQUE (tenant_id, user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS access_devices_tenant_status_idx
  ON platform.access_devices (tenant_id, status);
CREATE INDEX IF NOT EXISTS access_devices_tenant_user_idx
  ON platform.access_devices (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS access_devices_tenant_seen_idx
  ON platform.access_devices (tenant_id, last_seen_at);

CREATE TABLE IF NOT EXISTS platform.ip_geo_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL UNIQUE,
  city text,
  region text,
  country text,
  isp text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  looked_up_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid REFERENCES platform.tenants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ip_geo_cache_looked_up_idx
  ON platform.ip_geo_cache (looked_up_at);
