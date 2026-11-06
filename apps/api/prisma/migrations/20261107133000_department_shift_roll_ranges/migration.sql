CREATE TABLE IF NOT EXISTS platform.roll_department_shift_ranges (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  institution_id UUID NOT NULL,
  department_id UUID NOT NULL,
  shift_id UUID NOT NULL,
  admission_year INTEGER NOT NULL,
  sequence_start INTEGER NOT NULL,
  sequence_end INTEGER NOT NULL,
  next_sequence INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT roll_department_shift_ranges_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS roll_department_shift_ranges_key
  ON platform.roll_department_shift_ranges (tenant_id, department_id, shift_id, admission_year);

CREATE INDEX IF NOT EXISTS roll_department_shift_ranges_year_idx
  ON platform.roll_department_shift_ranges (tenant_id, admission_year);

DO $$ BEGIN
  ALTER TABLE platform.roll_department_shift_ranges
    ADD CONSTRAINT roll_department_shift_ranges_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES platform.tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE platform.roll_department_shift_ranges
    ADD CONSTRAINT roll_department_shift_ranges_institution_id_fkey
    FOREIGN KEY (institution_id) REFERENCES core.institutions(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE platform.roll_department_shift_ranges
    ADD CONSTRAINT roll_department_shift_ranges_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES core.departments(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE platform.roll_department_shift_ranges
    ADD CONSTRAINT roll_department_shift_ranges_shift_id_fkey
    FOREIGN KEY (shift_id) REFERENCES core.shifts(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
