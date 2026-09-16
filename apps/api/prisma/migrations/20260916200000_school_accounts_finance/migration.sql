CREATE TABLE IF NOT EXISTS school.school_fin_years (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  locked_at TIMESTAMPTZ,
  locked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS school.school_acct_periods (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES school.school_fin_years(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  locked_at TIMESTAMPTZ,
  locked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, financial_year_id, code)
);

CREATE TABLE IF NOT EXISTS school.school_acct_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id UUID REFERENCES school.school_acct_accounts(id) ON DELETE RESTRICT,
  system_key TEXT,
  module_key TEXT,
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_side TEXT NOT NULL DEFAULT 'DEBIT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS school_acct_accounts_sys_idx ON school.school_acct_accounts (tenant_id, system_key);
CREATE INDEX IF NOT EXISTS school_acct_accounts_type_idx ON school.school_acct_accounts (tenant_id, type, active);

CREATE TABLE IF NOT EXISTS school.school_acct_cost_centres (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS school.school_acct_bank_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  ledger_id UUID NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  branch TEXT,
  account_number TEXT NOT NULL,
  ifsc TEXT,
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_acct_vendors (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  address TEXT,
  pan TEXT,
  gstin TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc TEXT,
  category TEXT,
  tds_config_id UUID,
  payment_terms TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS school.school_acct_sequences (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  financial_year_id UUID NOT NULL,
  kind TEXT NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, financial_year_id, kind)
);

CREATE TABLE IF NOT EXISTS school.school_acct_vouchers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES school.school_fin_years(id) ON DELETE RESTRICT,
  academic_year_id UUID,
  period_id UUID,
  voucher_no TEXT NOT NULL,
  voucher_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  voucher_date DATE NOT NULL,
  narration TEXT NOT NULL,
  payer_name TEXT,
  payee_name TEXT,
  student_id UUID,
  vendor_id UUID,
  cost_centre_id UUID,
  payment_mode TEXT,
  bank_account_id UUID,
  reference_no TEXT,
  cheque_no TEXT,
  idempotency_key TEXT,
  source_module TEXT,
  source_id TEXT,
  reversal_of_id UUID REFERENCES school.school_acct_vouchers(id) ON DELETE RESTRICT,
  total_debit NUMERIC(18,2) NOT NULL,
  total_credit NUMERIC(18,2) NOT NULL,
  created_by UUID NOT NULL,
  created_ip TEXT,
  submitted_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, voucher_no),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS school_acct_vouchers_type_idx ON school.school_acct_vouchers (tenant_id, voucher_type, voucher_date);
CREATE INDEX IF NOT EXISTS school_acct_vouchers_status_idx ON school.school_acct_vouchers (tenant_id, status, voucher_date);
CREATE INDEX IF NOT EXISTS school_acct_vouchers_src_idx ON school.school_acct_vouchers (tenant_id, source_module, source_id);

CREATE TABLE IF NOT EXISTS school.school_acct_voucher_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  voucher_id UUID NOT NULL REFERENCES school.school_acct_vouchers(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES school.school_acct_accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  particulars TEXT,
  cost_centre_id UUID
);

CREATE INDEX IF NOT EXISTS school_acct_voucher_lines_acc_idx ON school.school_acct_voucher_lines (tenant_id, account_id);

CREATE TABLE IF NOT EXISTS school.school_acct_approval_rules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  voucher_type TEXT NOT NULL DEFAULT '*',
  min_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(18,2),
  approver_role TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school.school_acct_approval_actions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  voucher_id UUID NOT NULL REFERENCES school.school_acct_vouchers(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_acct_budgets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES school.school_fin_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_acct_budget_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  budget_id UUID NOT NULL REFERENCES school.school_acct_budgets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  cost_centre_id UUID,
  month_key TEXT,
  amount NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS school.school_acct_vendor_bills (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  vendor_id UUID NOT NULL REFERENCES school.school_acct_vendors(id) ON DELETE RESTRICT,
  bill_no TEXT NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'CREATED',
  subtotal NUMERIC(18,2) NOT NULL,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tds_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL,
  paid_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  voucher_id UUID,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, bill_no)
);

CREATE TABLE IF NOT EXISTS school.school_acct_vendor_bill_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  bill_id UUID NOT NULL REFERENCES school.school_acct_vendor_bills(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS school.school_acct_bank_statements (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES school.school_acct_bank_accounts(id) ON DELETE CASCADE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_name TEXT,
  created_by UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS school.school_acct_bank_stmt_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  statement_id UUID NOT NULL REFERENCES school.school_acct_bank_statements(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  side TEXT NOT NULL,
  reference TEXT,
  utr TEXT,
  cheque_no TEXT,
  narration TEXT,
  status TEXT NOT NULL DEFAULT 'UNMATCHED',
  voucher_id UUID
);

CREATE TABLE IF NOT EXISTS school.school_acct_assets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  purchase_value NUMERIC(18,2) NOT NULL,
  vendor_id UUID,
  invoice_no TEXT,
  location TEXT,
  department TEXT,
  useful_life_months INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'SLM',
  current_value NUMERIC(18,2) NOT NULL,
  disposed_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, asset_code)
);

CREATE TABLE IF NOT EXISTS school.school_acct_depreciations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES school.school_acct_assets(id) ON DELETE CASCADE,
  period_code TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  voucher_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, period_code)
);

CREATE TABLE IF NOT EXISTS school.school_acct_tax_configs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  tax_kind TEXT NOT NULL,
  name TEXT NOT NULL,
  law_ref TEXT,
  section_ref TEXT,
  rate_bps INTEGER NOT NULL,
  threshold NUMERIC(18,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  applies_to TEXT NOT NULL DEFAULT 'VENDOR',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_acct_tax_txns (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  config_id UUID NOT NULL,
  voucher_id UUID,
  vendor_id UUID,
  taxable NUMERIC(18,2) NOT NULL,
  tax_amount NUMERIC(18,2) NOT NULL,
  challan_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_acct_cash_closes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  close_date DATE NOT NULL,
  cashier_user_id UUID NOT NULL,
  expected_cash NUMERIC(18,2) NOT NULL,
  actual_cash NUMERIC(18,2) NOT NULL,
  difference NUMERIC(18,2) NOT NULL,
  explanation TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, close_date, cashier_user_id)
);

CREATE TABLE IF NOT EXISTS school.school_acct_audits (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  voucher_id UUID,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  ip TEXT,
  before_json JSONB NOT NULL DEFAULT '{}',
  after_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_acct_attachments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  voucher_id UUID REFERENCES school.school_acct_vouchers(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
