-- Don Bosco complete fee management expansion

CREATE TABLE IF NOT EXISTS finance.monthly_fee_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  program_id UUID,
  shift_id UUID,
  major_slug TEXT,
  stream_code TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS monthly_fee_plans_tenant_code_key ON finance.monthly_fee_plans(tenant_id, code);

CREATE TABLE IF NOT EXISTS finance.monthly_fee_plan_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES finance.monthly_fee_plans(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS monthly_fee_plan_lines_plan_code_key ON finance.monthly_fee_plan_lines(plan_id, code);

CREATE TABLE IF NOT EXISTS finance.monthly_fee_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plan_id UUID REFERENCES finance.monthly_fee_plans(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS monthly_fee_modifiers_tenant_code_key ON finance.monthly_fee_modifiers(tenant_id, code);

CREATE TABLE IF NOT EXISTS finance.fee_finance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  monthly_due_day INTEGER NOT NULL DEFAULT 10,
  late_fee_enabled BOOLEAN NOT NULL DEFAULT true,
  late_fee_mode TEXT NOT NULL DEFAULT 'PER_DAY',
  late_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 10,
  late_fee_grace_days INTEGER NOT NULL DEFAULT 0,
  receipt_prefix TEXT NOT NULL DEFAULT 'DBC/RCPT',
  online_payment_enabled BOOLEAN NOT NULL DEFAULT false,
  block_hall_ticket_on_due BOOLEAN NOT NULL DEFAULT true,
  block_registration_on_due BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance.scholarship_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  scheme_type TEXT NOT NULL,
  calculation_type TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS scholarship_schemes_tenant_code_key ON finance.scholarship_schemes(tenant_id, code);

CREATE TABLE IF NOT EXISTS finance.fee_product_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  engine_type TEXT NOT NULL,
  demand_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fee_product_registry_tenant_code_key ON finance.fee_product_registry(tenant_id, code);

-- student_fee_demands / fee_concessions alters deferred to 20260528001000_higher_ed_fees_module
