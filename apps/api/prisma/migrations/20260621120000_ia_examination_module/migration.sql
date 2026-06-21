-- NEHU Internal Assessment examination module

CREATE TABLE IF NOT EXISTS platform.tenant_examination_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES platform.tenants(id) ON DELETE CASCADE,
  legacy_university_exam_mode BOOLEAN NOT NULL DEFAULT false,
  ia_pass_mark_percent NUMERIC(5,2) NOT NULL DEFAULT 40,
  attendance_min_percent NUMERIC(5,2) NOT NULL DEFAULT 75,
  block_admit_on_defaulter BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic.ia_assessment_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  academic_year_id UUID,
  department_id UUID,
  programme_id UUID,
  course_id UUID,
  offering_id UUID,
  semester_no INT,
  name TEXT NOT NULL,
  total_max_marks NUMERIC(6,2) NOT NULL DEFAULT 40,
  pass_mark NUMERIC(6,2),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  is_locked BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ia_assessment_schemes_tenant_semester_idx
  ON academic.ia_assessment_schemes(tenant_id, semester_no);
CREATE INDEX IF NOT EXISTS ia_assessment_schemes_tenant_course_idx
  ON academic.ia_assessment_schemes(tenant_id, course_id);
CREATE INDEX IF NOT EXISTS ia_assessment_schemes_tenant_offering_idx
  ON academic.ia_assessment_schemes(tenant_id, offering_id);

CREATE TABLE IF NOT EXISTS academic.ia_assessment_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  scheme_id UUID NOT NULL REFERENCES academic.ia_assessment_schemes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  max_marks NUMERIC(6,2) NOT NULL,
  weightage NUMERIC(5,2),
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scheme_id, code)
);

CREATE INDEX IF NOT EXISTS ia_assessment_components_tenant_scheme_idx
  ON academic.ia_assessment_components(tenant_id, scheme_id);

CREATE TABLE IF NOT EXISTS academic.ia_component_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  session_id UUID,
  paper_id UUID,
  scheme_id UUID NOT NULL,
  component_id UUID NOT NULL REFERENCES academic.ia_assessment_components(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  marks NUMERIC(6,2),
  max_marks NUMERIC(6,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  is_absent BOOLEAN NOT NULL DEFAULT false,
  remarks TEXT,
  entered_by_id UUID,
  locked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(component_id, student_id, paper_id)
);

CREATE INDEX IF NOT EXISTS ia_component_marks_tenant_scheme_idx
  ON academic.ia_component_marks(tenant_id, scheme_id);
CREATE INDEX IF NOT EXISTS ia_component_marks_tenant_paper_idx
  ON academic.ia_component_marks(tenant_id, paper_id);
CREATE INDEX IF NOT EXISTS ia_component_marks_tenant_student_idx
  ON academic.ia_component_marks(tenant_id, student_id);

CREATE TABLE IF NOT EXISTS academic.ia_consolidation_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  academic_year_id UUID,
  department_id UUID,
  semester_no INT,
  session_id UUID,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  submitted_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ia_consolidation_sheets_tenant_status_idx
  ON academic.ia_consolidation_sheets(tenant_id, status);
CREATE INDEX IF NOT EXISTS ia_consolidation_sheets_tenant_dept_sem_idx
  ON academic.ia_consolidation_sheets(tenant_id, department_id, semester_no);

CREATE TABLE IF NOT EXISTS academic.ia_consolidation_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sheet_id UUID NOT NULL REFERENCES academic.ia_consolidation_sheets(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  course_id UUID,
  offering_id UUID,
  scheme_id UUID,
  total_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  result_status TEXT NOT NULL DEFAULT 'PENDING',
  component_json JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sheet_id, student_id, offering_id)
);

CREATE INDEX IF NOT EXISTS ia_consolidation_rows_tenant_sheet_idx
  ON academic.ia_consolidation_rows(tenant_id, sheet_id);
CREATE INDEX IF NOT EXISTS ia_consolidation_rows_tenant_student_idx
  ON academic.ia_consolidation_rows(tenant_id, student_id);

CREATE TABLE IF NOT EXISTS academic.ia_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sheet_id UUID NOT NULL REFERENCES academic.ia_consolidation_sheets(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL,
  step_name TEXT NOT NULL,
  role_slug TEXT NOT NULL,
  sequence INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  acted_by_id UUID,
  acted_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sheet_id, step_code)
);

CREATE INDEX IF NOT EXISTS ia_approval_steps_tenant_sheet_idx
  ON academic.ia_approval_steps(tenant_id, sheet_id);
CREATE INDEX IF NOT EXISTS ia_approval_steps_tenant_status_idx
  ON academic.ia_approval_steps(tenant_id, status);
