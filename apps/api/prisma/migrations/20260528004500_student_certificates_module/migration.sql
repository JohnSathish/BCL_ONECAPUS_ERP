CREATE SCHEMA IF NOT EXISTS academic;

CREATE TABLE IF NOT EXISTS academic.certificate_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  "group" text NOT NULL DEFAULT 'ACADEMIC',
  description text,
  icon text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp(3)
);

CREATE TABLE IF NOT EXISTS academic.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES academic.certificate_categories(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  language text NOT NULL DEFAULT 'en',
  orientation text NOT NULL DEFAULT 'PORTRAIT',
  page_size text NOT NULL DEFAULT 'A4',
  status text NOT NULL DEFAULT 'DRAFT',
  branding jsonb NOT NULL DEFAULT '{}',
  settings jsonb NOT NULL DEFAULT '{}',
  active_version_id uuid,
  created_by_id uuid,
  published_at timestamp(3),
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp(3)
);

CREATE TABLE IF NOT EXISTS academic.certificate_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES academic.certificate_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  mode text NOT NULL DEFAULT 'HTML',
  html text NOT NULL DEFAULT '',
  layout jsonb NOT NULL DEFAULT '{}',
  variables jsonb NOT NULL DEFAULT '[]',
  assets jsonb NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  created_by_id uuid,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic.certificate_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  template_id uuid REFERENCES academic.certificate_templates(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  source text NOT NULL DEFAULT 'SYSTEM',
  data_path text,
  default_value text,
  is_required boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic.certificate_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES academic.certificate_categories(id) ON DELETE RESTRICT,
  template_id uuid,
  student_id uuid NOT NULL,
  request_no text NOT NULL,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'SUBMITTED',
  priority text NOT NULL DEFAULT 'NORMAL',
  purpose text,
  variable_data jsonb NOT NULL DEFAULT '{}',
  supporting_files jsonb NOT NULL DEFAULT '[]',
  fee_demand_id uuid,
  submitted_by_id uuid,
  submitted_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp(3),
  rejected_at timestamp(3),
  rejection_reason text,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic.certificate_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES academic.certificate_categories(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES academic.certificate_templates(id) ON DELETE SET NULL,
  template_version_id uuid,
  request_id uuid REFERENCES academic.certificate_requests(id) ON DELETE SET NULL,
  student_id uuid NOT NULL,
  certificate_no text NOT NULL,
  issue_type text NOT NULL DEFAULT 'ORIGINAL',
  status text NOT NULL DEFAULT 'ISSUED',
  rendered_html text,
  pdf_path text,
  qr_payload text,
  verification_token text NOT NULL UNIQUE,
  variable_snapshot jsonb NOT NULL DEFAULT '{}',
  issued_by_id uuid,
  issued_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at timestamp(3),
  revoked_by_id uuid,
  revoke_reason text,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic.certificate_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES academic.certificate_requests(id) ON DELETE CASCADE,
  step_code text NOT NULL,
  step_name text NOT NULL,
  role_slug text,
  approver_id uuid,
  status text NOT NULL DEFAULT 'PENDING',
  comments text,
  sequence integer NOT NULL DEFAULT 1,
  due_at timestamp(3),
  acted_at timestamp(3),
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic.certificate_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  issue_id uuid NOT NULL REFERENCES academic.certificate_issues(id) ON DELETE CASCADE,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'VALID',
  verified_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address text,
  user_agent text,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS academic.certificate_number_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  category_code text NOT NULL,
  prefix text NOT NULL,
  suffix text,
  year integer NOT NULL,
  current_no integer NOT NULL DEFAULT 0,
  reset_rule text NOT NULL DEFAULT 'YEARLY',
  format text NOT NULL DEFAULT '{{prefix}}/{{year}}/{{number}}',
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic.certificate_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  role_slug text NOT NULL,
  display_name text NOT NULL,
  designation text,
  signature_path text,
  seal_path text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp(3)
);

CREATE TABLE IF NOT EXISTS academic.certificate_download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  issue_id uuid NOT NULL REFERENCES academic.certificate_issues(id) ON DELETE CASCADE,
  downloaded_by_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic.certificate_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  template_id uuid REFERENCES academic.certificate_templates(id) ON DELETE SET NULL,
  request_id uuid REFERENCES academic.certificate_requests(id) ON DELETE SET NULL,
  issue_id uuid REFERENCES academic.certificate_issues(id) ON DELETE SET NULL,
  actor_id uuid,
  action text NOT NULL,
  reason text,
  ip_address text,
  before jsonb,
  after jsonb,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS certificate_categories_tenant_code_key ON academic.certificate_categories(tenant_id, code);
CREATE INDEX IF NOT EXISTS certificate_categories_group_idx ON academic.certificate_categories(tenant_id, "group", is_active);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_templates_tenant_code_key ON academic.certificate_templates(tenant_id, code);
CREATE INDEX IF NOT EXISTS certificate_templates_category_status_idx ON academic.certificate_templates(tenant_id, category_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_template_versions_template_version_key ON academic.certificate_template_versions(template_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_variables_tenant_template_key ON academic.certificate_variables(tenant_id, template_id, key);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_requests_tenant_request_no_key ON academic.certificate_requests(tenant_id, request_no);
CREATE INDEX IF NOT EXISTS certificate_requests_student_status_idx ON academic.certificate_requests(tenant_id, student_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_issues_tenant_certificate_no_key ON academic.certificate_issues(tenant_id, certificate_no);
CREATE INDEX IF NOT EXISTS certificate_issues_student_status_idx ON academic.certificate_issues(tenant_id, student_id, status);
CREATE INDEX IF NOT EXISTS certificate_approvals_role_status_idx ON academic.certificate_approvals(tenant_id, role_slug, status);
CREATE INDEX IF NOT EXISTS certificate_verifications_token_idx ON academic.certificate_verifications(token);
CREATE UNIQUE INDEX IF NOT EXISTS certificate_number_sequences_tenant_category_year_key ON academic.certificate_number_sequences(tenant_id, category_code, year);
CREATE INDEX IF NOT EXISTS certificate_signatures_role_active_idx ON academic.certificate_signatures(tenant_id, role_slug, is_active);
CREATE INDEX IF NOT EXISTS certificate_audit_logs_action_created_idx ON academic.certificate_audit_logs(tenant_id, action, created_at);
