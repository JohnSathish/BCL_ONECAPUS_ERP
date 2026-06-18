CREATE SCHEMA IF NOT EXISTS finance;

ALTER TABLE finance.fee_structures
  ADD COLUMN IF NOT EXISTS institution_id uuid,
  ADD COLUMN IF NOT EXISTS academic_year_id uuid,
  ADD COLUMN IF NOT EXISTS semester_id uuid,
  ADD COLUMN IF NOT EXISTS stream_id uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS program_version_id uuid,
  ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS billing_frequency text NOT NULL DEFAULT 'YEARLY',
  ADD COLUMN IF NOT EXISTS collection_mode text NOT NULL DEFAULT 'AUTO_MANUAL',
  ADD COLUMN IF NOT EXISTS applicability jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS published_at timestamp(3),
  ADD COLUMN IF NOT EXISTS locked_at timestamp(3),
  ADD COLUMN IF NOT EXISTS created_by_id uuid;

ALTER TABLE finance.fee_rules
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'PRACTICAL',
  ADD COLUMN IF NOT EXISTS billing_layer text NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date;

CREATE TABLE IF NOT EXISTS finance.fee_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  fee_structure_id uuid NOT NULL REFERENCES finance.fee_structures(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  billing_frequency text NOT NULL DEFAULT 'YEARLY',
  semester_numbers jsonb NOT NULL DEFAULT '[]',
  subject_categories jsonb NOT NULL DEFAULT '[]',
  practical_dependency boolean NOT NULL DEFAULT false,
  optional_subject_rule jsonb,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp(3)
);

CREATE TABLE IF NOT EXISTS finance.fee_renewal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  fee_structure_id uuid REFERENCES finance.fee_structures(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  academic_year_no integer NOT NULL,
  semester_start integer NOT NULL,
  semester_end integer NOT NULL,
  trigger_mode text NOT NULL DEFAULT 'AUTO_MANUAL',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.student_fee_demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  fee_structure_id uuid REFERENCES finance.fee_structures(id) ON DELETE SET NULL,
  academic_year_id uuid,
  semester_id uuid,
  semester_number integer,
  academic_year_no integer,
  demand_no text NOT NULL,
  demand_type text NOT NULL DEFAULT 'GENERAL',
  billing_layer text NOT NULL DEFAULT 'YEARLY',
  billing_period text,
  status text NOT NULL DEFAULT 'DRAFT',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  concession_amount numeric(12,2) NOT NULL DEFAULT 0,
  fine_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  balance_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  due_date date,
  published_at timestamp(3),
  locked_at timestamp(3),
  cancelled_at timestamp(3),
  rollback_of_demand_id uuid,
  fee_cycle_id uuid REFERENCES finance.academic_fee_cycles(id) ON DELETE SET NULL,
  fee_product_code text,
  monthly_fee_plan_id uuid,
  generated_by_id uuid,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.student_fee_demand_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  demand_id uuid NOT NULL REFERENCES finance.student_fee_demands(id) ON DELETE CASCADE,
  fee_component_id uuid REFERENCES finance.fee_components(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_amount numeric(12,2) NOT NULL,
  amount numeric(12,2) NOT NULL,
  source_type text NOT NULL DEFAULT 'STRUCTURE',
  source_ref_id uuid,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  transaction_no text NOT NULL,
  payment_mode text NOT NULL,
  provider text,
  provider_order_id text,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'PENDING',
  amount numeric(12,2) NOT NULL,
  allocated_amount numeric(12,2) NOT NULL DEFAULT 0,
  unallocated_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  paid_at timestamp(3),
  collected_by_id uuid,
  collection_session_id uuid,
  payment_source varchar(64),
  external_reference varchar(128),
  remarks text,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.fee_concessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  demand_id uuid REFERENCES finance.student_fee_demands(id) ON DELETE SET NULL,
  scheme_id uuid REFERENCES finance.scholarship_schemes(id) ON DELETE SET NULL,
  concession_type text NOT NULL,
  calculation_type text NOT NULL,
  value numeric(12,2) NOT NULL,
  approved_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING',
  reason text,
  requested_by_id uuid,
  approved_by_id uuid,
  approved_at timestamp(3),
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.student_fee_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  demand_id uuid REFERENCES finance.student_fee_demands(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES finance.payment_transactions(id) ON DELETE SET NULL,
  concession_id uuid REFERENCES finance.fee_concessions(id) ON DELETE SET NULL,
  entry_no text NOT NULL,
  entry_type text NOT NULL,
  debit_amount numeric(12,2) NOT NULL DEFAULT 0,
  credit_amount numeric(12,2) NOT NULL DEFAULT 0,
  running_balance numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  reference_type text,
  reference_id uuid,
  description text,
  posted_by_id uuid,
  posted_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  payment_id uuid NOT NULL REFERENCES finance.payment_transactions(id) ON DELETE CASCADE,
  demand_id uuid NOT NULL REFERENCES finance.student_fee_demands(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS finance.fee_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  receipt_no text NOT NULL,
  student_id uuid NOT NULL,
  demand_id uuid REFERENCES finance.student_fee_demands(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES finance.payment_transactions(id) ON DELETE SET NULL,
  receipt_type text NOT NULL DEFAULT 'PAYMENT',
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'ISSUED',
  issued_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  issued_by_id uuid,
  pdf_path text,
  qr_payload text,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS finance.fee_fine_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  rule_type text NOT NULL,
  amount numeric(12,2) NOT NULL,
  percentage numeric(5,2),
  grace_days integer NOT NULL DEFAULT 0,
  slabs jsonb NOT NULL DEFAULT '[]',
  actions jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_to date,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.payment_gateway_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  payment_id uuid REFERENCES finance.payment_transactions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL,
  request jsonb,
  response jsonb,
  signature_ok boolean,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.fee_collection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  session_no text NOT NULL,
  cashier_id uuid,
  opened_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at timestamp(3),
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  closing_balance numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'OPEN',
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance.fee_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  fee_structure_id uuid REFERENCES finance.fee_structures(id) ON DELETE SET NULL,
  demand_id uuid REFERENCES finance.student_fee_demands(id) ON DELETE SET NULL,
  actor_id uuid,
  action text NOT NULL,
  reason text,
  ip_address text,
  before jsonb,
  after jsonb,
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS fee_structures_tenant_code_version_key ON finance.fee_structures(tenant_id, code, version);
CREATE INDEX IF NOT EXISTS fee_structures_tenant_status_idx ON finance.fee_structures(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS fee_components_structure_code_key ON finance.fee_components(fee_structure_id, code);
CREATE INDEX IF NOT EXISTS fee_components_tenant_category_idx ON finance.fee_components(tenant_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS fee_renewal_rules_tenant_code_key ON finance.fee_renewal_rules(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS student_fee_demands_tenant_demand_no_key ON finance.student_fee_demands(tenant_id, demand_no);
CREATE INDEX IF NOT EXISTS student_fee_demands_student_status_idx ON finance.student_fee_demands(tenant_id, student_id, status);
CREATE INDEX IF NOT EXISTS student_fee_demand_lines_demand_idx ON finance.student_fee_demand_lines(tenant_id, demand_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_fee_ledger_entries_tenant_entry_no_key ON finance.student_fee_ledger_entries(tenant_id, entry_no);
CREATE INDEX IF NOT EXISTS student_fee_ledger_entries_student_posted_idx ON finance.student_fee_ledger_entries(tenant_id, student_id, posted_at);
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_tenant_transaction_no_key ON finance.payment_transactions(tenant_id, transaction_no);
CREATE INDEX IF NOT EXISTS payment_transactions_student_status_idx ON finance.payment_transactions(tenant_id, student_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS payment_allocations_payment_demand_key ON finance.payment_allocations(payment_id, demand_id);
CREATE UNIQUE INDEX IF NOT EXISTS fee_receipts_tenant_receipt_no_key ON finance.fee_receipts(tenant_id, receipt_no);
CREATE INDEX IF NOT EXISTS fee_concessions_student_status_idx ON finance.fee_concessions(tenant_id, student_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS fee_fine_rules_tenant_code_key ON finance.fee_fine_rules(tenant_id, code);
CREATE INDEX IF NOT EXISTS payment_gateway_logs_provider_created_idx ON finance.payment_gateway_logs(tenant_id, provider, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS fee_collection_sessions_tenant_session_no_key ON finance.fee_collection_sessions(tenant_id, session_no);
CREATE INDEX IF NOT EXISTS fee_audit_logs_action_created_idx ON finance.fee_audit_logs(tenant_id, action, created_at);

-- Deferred from earlier fee migrations (tables did not exist yet on fresh deploy)
CREATE INDEX IF NOT EXISTS student_fee_demands_tenant_fee_cycle_idx ON finance.student_fee_demands(tenant_id, fee_cycle_id);
CREATE INDEX IF NOT EXISTS student_fee_demands_tenant_balance_idx ON finance.student_fee_demands(tenant_id, balance_amount) WHERE balance_amount > 0;
CREATE UNIQUE INDEX IF NOT EXISTS student_fee_demands_monthly_unique_idx
  ON finance.student_fee_demands(tenant_id, student_id, demand_type, billing_period)
  WHERE demand_type = 'MONTHLY_TUITION' AND billing_period IS NOT NULL AND status NOT IN ('CANCELLED', 'ROLLED_BACK');
CREATE INDEX IF NOT EXISTS payment_transactions_tenant_payment_source_idx ON finance.payment_transactions(tenant_id, payment_source);
