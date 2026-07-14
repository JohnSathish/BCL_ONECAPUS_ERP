-- Enterprise platform spine: module entitlements, workflow engine, and net-new MVP modules

-- ── Module entitlements ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.tenant_module_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_at timestamptz,
  disabled_at timestamptz,
  updated_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_module_entitlements_tenant_module_key UNIQUE (tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS tenant_module_entitlements_tenant_idx
  ON platform.tenant_module_entitlements (tenant_id);

-- ── Workflow engine ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  entity_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_definitions_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS platform.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  definition_id uuid NOT NULL REFERENCES platform.workflow_definitions(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  name text NOT NULL,
  assignee_role text,
  assignee_permission text,
  sla_hours int,
  is_parallel boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_steps_def_order UNIQUE (definition_id, step_order)
);

CREATE TABLE IF NOT EXISTS platform.workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  definition_id uuid NOT NULL REFERENCES platform.workflow_definitions(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  current_step_order int NOT NULL DEFAULT 1,
  started_by_id uuid,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_instances_tenant_status_idx
  ON platform.workflow_instances (tenant_id, status);
CREATE INDEX IF NOT EXISTS workflow_instances_entity_idx
  ON platform.workflow_instances (tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS platform.workflow_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES platform.workflow_instances(id) ON DELETE CASCADE,
  step_id uuid REFERENCES platform.workflow_steps(id) ON DELETE SET NULL,
  action text NOT NULL,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.workflow_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  instance_id uuid NOT NULL REFERENCES platform.workflow_instances(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Help desk ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ticket_no text NOT NULL,
  category text NOT NULL DEFAULT 'GENERAL',
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'OPEN',
  priority text NOT NULL DEFAULT 'MEDIUM',
  requester_user_id uuid,
  requester_type text NOT NULL DEFAULT 'STAFF',
  assignee_user_id uuid,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_tenant_no UNIQUE (tenant_id, ticket_no)
);

CREATE INDEX IF NOT EXISTS support_tickets_tenant_status_idx
  ON platform.support_tickets (tenant_id, status);

CREATE TABLE IF NOT EXISTS platform.support_ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ticket_id uuid NOT NULL REFERENCES platform.support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Parent links ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic.parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  parent_user_id uuid NOT NULL,
  student_id uuid NOT NULL,
  relationship text NOT NULL DEFAULT 'GUARDIAN',
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_student_links_unique UNIQUE (tenant_id, parent_user_id, student_id)
);

CREATE INDEX IF NOT EXISTS parent_student_links_parent_idx
  ON academic.parent_student_links (tenant_id, parent_user_id);

-- ── Placement ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic.placement_recruiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  industry text,
  website text,
  status text NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic.placement_drives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  recruiter_id uuid NOT NULL REFERENCES academic.placement_recruiters(id) ON DELETE CASCADE,
  title text NOT NULL,
  drive_date date,
  job_role text,
  package_lpa numeric(10,2),
  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic.placement_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  drive_id uuid NOT NULL REFERENCES academic.placement_drives(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'APPLIED',
  offer_package_lpa numeric(10,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT placement_applications_unique UNIQUE (drive_id, student_id)
);

-- ── Internship ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic.internship_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  address text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic.internship_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES academic.internship_companies(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  mentor_staff_id uuid,
  title text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'ONGOING',
  evaluation_score numeric(5,2),
  evaluation_notes text,
  certificate_issue_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Alumni ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic.alumni_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id uuid,
  user_id uuid,
  full_name text NOT NULL,
  graduation_year int,
  programme text,
  email text,
  phone text,
  current_org text,
  "current_role" text,
  mentorship_opt_in boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS alumni_profiles_tenant_student_uidx
  ON academic.alumni_profiles (tenant_id, student_id)
  WHERE student_id IS NOT NULL;

-- ── Hostel ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic.hostel_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  gender text,
  capacity int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hostel_blocks_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS academic.hostel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  block_id uuid NOT NULL REFERENCES academic.hostel_blocks(id) ON DELETE CASCADE,
  room_no text NOT NULL,
  capacity int NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'AVAILABLE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hostel_rooms_block_room UNIQUE (block_id, room_no)
);

CREATE TABLE IF NOT EXISTS academic.hostel_allotments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES academic.hostel_rooms(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  allotted_at timestamptz NOT NULL DEFAULT now(),
  vacated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hostel_allotments_tenant_student_idx
  ON academic.hostel_allotments (tenant_id, student_id);

-- ── Visitor enhancements (campus access extension table) ─────────────────
CREATE TABLE IF NOT EXISTS access.visitor_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  visitor_name text NOT NULL,
  phone text,
  photo_url text,
  vehicle_number text,
  host_user_id uuid,
  host_name text,
  purpose text,
  pass_code text,
  qr_token text,
  status text NOT NULL DEFAULT 'CHECKED_IN',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_visits_tenant_status_idx
  ON access.visitor_visits (tenant_id, status);

-- ── Inventory AMC / service history ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance.inventory_asset_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  inventory_item_id uuid,
  asset_tag text,
  service_type text NOT NULL DEFAULT 'AMC',
  vendor_name text,
  service_date date,
  warranty_until date,
  amc_until date,
  cost numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_asset_services_tenant_idx
  ON finance.inventory_asset_services (tenant_id);

-- ── Research grants (light) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic.research_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  principal_investigator_id uuid,
  funding_agency text,
  amount numeric(14,2),
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Integration connectors registry ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.integration_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_connectors_tenant_provider UNIQUE (tenant_id, provider)
);
