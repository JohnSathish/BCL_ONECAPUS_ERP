-- Academic Fee Cycle Management (Don Bosco FYUGP model)

CREATE TABLE IF NOT EXISTS finance.fee_head_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  category TEXT NOT NULL DEFAULT 'SESSION',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS fee_head_masters_tenant_code_key
  ON finance.fee_head_masters(tenant_id, code);
CREATE INDEX IF NOT EXISTS fee_head_masters_tenant_active_sort_idx
  ON finance.fee_head_masters(tenant_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS finance.academic_fee_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  academic_year_id UUID,
  program_id UUID,
  department_id UUID,
  shift_id UUID,
  fyugp_year INTEGER,
  start_semester INTEGER NOT NULL,
  end_semester INTEGER NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  description TEXT,
  metadata JSONB,
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_fee_cycles_tenant_code_key
  ON finance.academic_fee_cycles(tenant_id, code);
CREATE INDEX IF NOT EXISTS academic_fee_cycles_tenant_status_idx
  ON finance.academic_fee_cycles(tenant_id, status);
CREATE INDEX IF NOT EXISTS academic_fee_cycles_tenant_start_sem_idx
  ON finance.academic_fee_cycles(tenant_id, start_semester);
CREATE INDEX IF NOT EXISTS academic_fee_cycles_tenant_program_idx
  ON finance.academic_fee_cycles(tenant_id, program_id);
CREATE INDEX IF NOT EXISTS academic_fee_cycles_tenant_shift_idx
  ON finance.academic_fee_cycles(tenant_id, shift_id);

CREATE TABLE IF NOT EXISTS finance.academic_fee_cycle_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  fee_cycle_id UUID NOT NULL REFERENCES finance.academic_fee_cycles(id) ON DELETE CASCADE,
  fee_head_id UUID NOT NULL REFERENCES finance.fee_head_masters(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_fee_cycle_lines_cycle_head_key
  ON finance.academic_fee_cycle_lines(fee_cycle_id, fee_head_id);
CREATE INDEX IF NOT EXISTS academic_fee_cycle_lines_tenant_cycle_idx
  ON finance.academic_fee_cycle_lines(tenant_id, fee_cycle_id);

-- student_fee_demands columns/index deferred to 20260528001000_higher_ed_fees_module
