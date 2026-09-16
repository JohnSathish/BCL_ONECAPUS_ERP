CREATE TABLE IF NOT EXISTS school.school_sms_settings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE,
  default_sender_id TEXT,
  enforce_dlt BOOLEAN NOT NULL DEFAULT TRUE,
  enforce_dlt_on_service BOOLEAN NOT NULL DEFAULT FALSE,
  failover_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_per_minute INTEGER NOT NULL DEFAULT 60,
  max_campaign_size INTEGER NOT NULL DEFAULT 5000,
  retry_attempts INTEGER NOT NULL DEFAULT 3,
  otp_expiry_minutes INTEGER NOT NULL DEFAULT 5,
  otp_max_attempts INTEGER NOT NULL DEFAULT 5,
  unit_cost NUMERIC(18, 4) NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'INR',
  manual_balance INTEGER NOT NULL DEFAULT 0,
  entity_id TEXT,
  entity_name TEXT,
  extras_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_sms_gateways (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  api_url TEXT,
  sender_id TEXT,
  dlt_entity_id TEXT,
  dlt_header TEXT,
  environment TEXT NOT NULL DEFAULT 'LIVE',
  status TEXT NOT NULL DEFAULT 'INACTIVE',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  failover_rank INTEGER NOT NULL DEFAULT 0,
  credentials_enc TEXT,
  last_error TEXT,
  last_success_at TIMESTAMPTZ,
  health TEXT NOT NULL DEFAULT 'UNKNOWN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_sms_gateways_default_idx
  ON school.school_sms_gateways (tenant_id, is_default);

CREATE TABLE IF NOT EXISTS school.school_sms_headers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  header TEXT NOT NULL,
  description TEXT,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, header)
);

CREATE TABLE IF NOT EXISTS school.school_sms_dlt_templates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  dlt_template_id TEXT NOT NULL,
  category TEXT NOT NULL,
  template_text TEXT NOT NULL,
  variables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, dlt_template_id)
);

CREATE TABLE IF NOT EXISTS school.school_sms_templates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  category TEXT NOT NULL,
  sms_kind TEXT NOT NULL DEFAULT 'SERVICE',
  dlt_template_id TEXT,
  header_id UUID,
  body TEXT NOT NULL,
  variables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS school.school_sms_campaigns (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  sms_kind TEXT NOT NULL DEFAULT 'SERVICE',
  audience_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_id UUID,
  gateway_id UUID,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  scheduled_at TIMESTAMPTZ,
  recurrence TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_sms_campaigns_sched_idx
  ON school.school_sms_campaigns (tenant_id, status, scheduled_at);

CREATE TABLE IF NOT EXISTS school.school_sms_messages (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campaign_id UUID REFERENCES school.school_sms_campaigns(id) ON DELETE SET NULL,
  student_id UUID,
  staff_id UUID,
  recipient_name TEXT,
  recipient_type TEXT NOT NULL,
  mobile TEXT NOT NULL,
  body TEXT NOT NULL,
  template_id UUID,
  gateway_id UUID REFERENCES school.school_sms_gateways(id) ON DELETE SET NULL,
  sender_id TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  error_code TEXT,
  error_message TEXT,
  error_class TEXT,
  segments INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  failover_used BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS school_sms_messages_status_idx
  ON school.school_sms_messages (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS school_sms_messages_mobile_idx
  ON school.school_sms_messages (tenant_id, mobile);

CREATE TABLE IF NOT EXISTS school.school_sms_message_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  message_id UUID NOT NULL REFERENCES school.school_sms_messages(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_sms_webhook_events (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  payload_json JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS school.school_sms_credit_txns (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_sms_consents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  student_id UUID,
  staff_id UUID,
  mobile TEXT,
  sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  fee_sms BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_sms BOOLEAN NOT NULL DEFAULT TRUE,
  exam_sms BOOLEAN NOT NULL DEFAULT TRUE,
  transport_sms BOOLEAN NOT NULL DEFAULT TRUE,
  general_sms BOOLEAN NOT NULL DEFAULT TRUE,
  promotional_sms BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_sms_otps (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  mobile TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_sms_audits (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  ip TEXT,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
