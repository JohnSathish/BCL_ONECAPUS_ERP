-- Appointment Order Management Phase 1

ALTER TABLE academic.recruitment_applications
  ADD COLUMN IF NOT EXISTS application_no TEXT,
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address_json JSONB,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE TABLE IF NOT EXISTS academic.appointment_order_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  year INT NOT NULL,
  current_no INT NOT NULL DEFAULT 0,
  prefix TEXT NOT NULL DEFAULT 'DBC/APPT',
  format TEXT NOT NULL DEFAULT '{{prefix}}/{{year}}/{{number}}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, year)
);

CREATE TABLE IF NOT EXISTS academic.appointment_order_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  staff_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS academic.appointment_order_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES academic.appointment_order_templates(id) ON DELETE CASCADE,
  version_no INT NOT NULL DEFAULT 1,
  body_html TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_order_template_versions_tenant_template_idx
  ON academic.appointment_order_template_versions (tenant_id, template_id);

CREATE TABLE IF NOT EXISTS academic.appointment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  application_id UUID NOT NULL REFERENCES academic.recruitment_applications(id) ON DELETE CASCADE,
  vacancy_id UUID,
  offer_id UUID,
  staff_profile_id UUID REFERENCES academic.staff_profiles(id) ON DELETE SET NULL,
  template_id UUID REFERENCES academic.appointment_order_templates(id) ON DELETE SET NULL,
  supersedes_order_id UUID,
  revision_no INT NOT NULL DEFAULT 1,
  order_no TEXT,
  reference_no TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  candidate_name TEXT NOT NULL,
  father_name TEXT,
  address_text TEXT,
  mobile TEXT,
  email TEXT,
  date_of_birth DATE,
  qualification TEXT,
  photo_url TEXT,
  appointment_type TEXT NOT NULL,
  employment_mode TEXT NOT NULL DEFAULT 'FULL_TIME',
  staff_type TEXT NOT NULL,
  designation_id UUID,
  department_id UUID,
  shift_id UUID,
  joining_date DATE,
  reporting_to TEXT,
  basic_pay DECIMAL(12,2),
  gross_salary DECIMAL(12,2),
  total_deductions DECIMAL(12,2),
  net_salary DECIMAL(12,2),
  pay_structure_template_id UUID,
  salary_breakup JSONB,
  terms_html TEXT,
  rendered_html TEXT,
  pdf_path TEXT,
  verify_token TEXT UNIQUE,
  verify_hash TEXT,
  verify_code TEXT,
  signed_copy_url TEXT,
  generated_by_id UUID,
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by_id UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, order_no)
);

CREATE INDEX IF NOT EXISTS appointment_orders_tenant_status_idx
  ON academic.appointment_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS appointment_orders_tenant_application_idx
  ON academic.appointment_orders (tenant_id, application_id);
CREATE INDEX IF NOT EXISTS appointment_orders_tenant_department_idx
  ON academic.appointment_orders (tenant_id, department_id);

CREATE TABLE IF NOT EXISTS academic.appointment_order_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES academic.appointment_orders(id) ON DELETE CASCADE,
  actor_id UUID,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_order_audit_logs_tenant_order_idx
  ON academic.appointment_order_audit_logs (tenant_id, order_id, created_at);

CREATE TABLE IF NOT EXISTS academic.joining_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  appointment_order_id UUID NOT NULL UNIQUE REFERENCES academic.appointment_orders(id) ON DELETE CASCADE,
  staff_profile_id UUID REFERENCES academic.staff_profiles(id) ON DELETE SET NULL,
  actual_joining_date DATE NOT NULL,
  reporting_date DATE,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  remarks TEXT,
  document_url TEXT,
  submitted_by_id UUID,
  verified_by_id UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS joining_reports_tenant_status_idx
  ON academic.joining_reports (tenant_id, status);
