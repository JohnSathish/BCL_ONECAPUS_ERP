-- Staff Module: unified StaffProfile, migrate from legacy faculty tables

CREATE TABLE IF NOT EXISTS core.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS designations_tenant_id_idx ON core.designations (tenant_id);

CREATE TABLE IF NOT EXISTS academic.staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT,
  date_of_birth DATE,
  mobile TEXT,
  email TEXT,
  aadhaar_no TEXT,
  pan_no TEXT,
  photo_url TEXT,
  rfid_no TEXT,
  biometric_id TEXT,
  staff_type TEXT NOT NULL DEFAULT 'TEACHING',
  employment_type TEXT NOT NULL DEFAULT 'PERMANENT',
  designation_id UUID REFERENCES core.designations(id) ON DELETE SET NULL,
  department_id UUID REFERENCES core.departments(id) ON DELETE SET NULL,
  primary_shift_id UUID REFERENCES core.shifts(id) ON DELETE SET NULL,
  joining_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  qualification TEXT,
  specialization TEXT,
  experience_years INT,
  portal_user_id UUID UNIQUE REFERENCES platform.users(id) ON DELETE SET NULL,
  address_json JSONB,
  emergency_contact_json JSONB,
  attendance_device_mapping JSONB,
  bank_name TEXT,
  account_number TEXT,
  ifsc TEXT,
  pf_number TEXT,
  basic_pay DECIMAL(12,2),
  salary_structure JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, employee_code)
);

CREATE INDEX IF NOT EXISTS staff_profiles_tenant_id_idx ON academic.staff_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS staff_profiles_department_id_idx ON academic.staff_profiles (department_id);
CREATE INDEX IF NOT EXISTS staff_profiles_staff_type_idx ON academic.staff_profiles (staff_type);
CREATE INDEX IF NOT EXISTS staff_profiles_status_idx ON academic.staff_profiles (status);

-- Migrate legacy faculty rows into staff_profiles
INSERT INTO academic.staff_profiles (
  id, tenant_id, employee_code, full_name, email, department_id, portal_user_id, staff_type, created_at, updated_at
)
SELECT
  f.id,
  f.tenant_id,
  f.employee_code,
  COALESCE(u.display_name, u.email, f.employee_code),
  u.email,
  f.department_id,
  f.user_id,
  'TEACHING',
  f.created_at,
  f.updated_at
FROM academic.faculty f
JOIN platform.users u ON u.id = f.user_id
WHERE f.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS academic.staff_shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  staff_profile_id UUID NOT NULL REFERENCES academic.staff_profiles(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES core.shifts(id) ON DELETE CASCADE,
  hours_per_week DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_profile_id, shift_id)
);

CREATE INDEX IF NOT EXISTS staff_shift_assignments_tenant_id_idx ON academic.staff_shift_assignments (tenant_id);

INSERT INTO academic.staff_shift_assignments (id, tenant_id, staff_profile_id, shift_id, hours_per_week, created_at)
SELECT fsa.id, fsa.tenant_id, fsa.faculty_id, fsa.shift_id, fsa.hours_per_week, fsa.created_at
FROM academic.faculty_shift_assignments fsa
ON CONFLICT (staff_profile_id, shift_id) DO NOTHING;

ALTER TABLE academic.offering_sections ADD COLUMN IF NOT EXISTS staff_profile_id UUID REFERENCES academic.staff_profiles(id) ON DELETE SET NULL;

UPDATE academic.offering_sections os
SET staff_profile_id = os.faculty_id
WHERE os.faculty_id IS NOT NULL AND os.staff_profile_id IS NULL;

ALTER TABLE academic.timetable_entries ADD COLUMN IF NOT EXISTS staff_profile_id UUID;

UPDATE academic.timetable_entries te
SET staff_profile_id = te.faculty_id
WHERE te.faculty_id IS NOT NULL AND te.staff_profile_id IS NULL;

CREATE TABLE IF NOT EXISTS academic.staff_subject_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  staff_profile_id UUID NOT NULL REFERENCES academic.staff_profiles(id) ON DELETE CASCADE,
  program_version_id UUID REFERENCES academic.program_versions(id) ON DELETE SET NULL,
  semester_no INT NOT NULL,
  course_id UUID NOT NULL REFERENCES academic.courses(id) ON DELETE RESTRICT,
  offering_section_id UUID REFERENCES academic.offering_sections(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES core.shifts(id) ON DELETE SET NULL,
  academic_year_id UUID REFERENCES core.academic_years(id) ON DELETE SET NULL,
  category TEXT,
  workload_hours DECIMAL(5,2),
  is_primary_faculty BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_profile_id, offering_section_id)
);

CREATE INDEX IF NOT EXISTS staff_subject_assignments_tenant_id_idx ON academic.staff_subject_assignments (tenant_id);
CREATE INDEX IF NOT EXISTS staff_subject_assignments_staff_profile_id_idx ON academic.staff_subject_assignments (staff_profile_id);
CREATE INDEX IF NOT EXISTS staff_subject_assignments_course_id_idx ON academic.staff_subject_assignments (course_id);

CREATE TABLE IF NOT EXISTS academic.staff_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  staff_profile_id UUID NOT NULL REFERENCES academic.staff_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  verified_by_id UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_documents_tenant_staff_idx ON academic.staff_documents (tenant_id, staff_profile_id);

CREATE TABLE IF NOT EXISTS academic.staff_workloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  staff_profile_id UUID NOT NULL REFERENCES academic.staff_profiles(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES core.academic_years(id) ON DELETE SET NULL,
  weekly_hours DECIMAL(5,2),
  max_credits DECIMAL(5,2),
  theory_hours DECIMAL(5,2),
  practical_hours DECIMAL(5,2),
  tutorial_hours DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_profile_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS staff_workloads_tenant_id_idx ON academic.staff_workloads (tenant_id);

-- Repoint department HoD FK from legacy faculty to staff_profiles
ALTER TABLE core.departments DROP CONSTRAINT IF EXISTS departments_hod_id_fkey;
ALTER TABLE core.departments
  ADD CONSTRAINT departments_hod_id_fkey
  FOREIGN KEY (hod_id) REFERENCES academic.staff_profiles(id) ON DELETE SET NULL;

-- Drop legacy faculty tables after migration
DROP TABLE IF EXISTS academic.faculty_shift_assignments;
ALTER TABLE academic.offering_sections DROP COLUMN IF EXISTS faculty_id;
ALTER TABLE academic.timetable_entries DROP COLUMN IF EXISTS faculty_id;
DROP TABLE IF EXISTS academic.faculty;
