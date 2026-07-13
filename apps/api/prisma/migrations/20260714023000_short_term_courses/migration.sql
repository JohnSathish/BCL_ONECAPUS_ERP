-- Short-term / certificate courses module
CREATE TABLE IF NOT EXISTS academic.short_term_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'CERTIFICATE',
  department_id UUID,
  description TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  outcomes JSONB NOT NULL DEFAULT '[]',
  banner_url TEXT,
  mode TEXT NOT NULL DEFAULT 'OFFLINE',
  duration_days INT NOT NULL DEFAULT 30,
  total_hours INT NOT NULL DEFAULT 0,
  sessions_count INT NOT NULL DEFAULT 0,
  fee_type TEXT NOT NULL DEFAULT 'PAID',
  fees JSONB NOT NULL DEFAULT '{}',
  eligibility JSONB NOT NULL DEFAULT '{"scope":"ALL"}',
  max_seats INT NOT NULL DEFAULT 40,
  cert_rules JSONB NOT NULL DEFAULT '{"minAttendancePercent":80,"passRequired":true}',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS short_term_courses_tenant_status_idx ON academic.short_term_courses (tenant_id, status);
CREATE INDEX IF NOT EXISTS short_term_courses_tenant_category_idx ON academic.short_term_courses (tenant_id, category);

CREATE TABLE IF NOT EXISTS academic.short_term_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES academic.short_term_courses(id) ON DELETE CASCADE,
  batch_code TEXT NOT NULL,
  reg_start_at TIMESTAMPTZ,
  reg_end_at TIMESTAMPTZ,
  course_start_at TIMESTAMPTZ,
  course_end_at TIMESTAMPTZ,
  classroom TEXT,
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'UPCOMING',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, batch_code)
);
CREATE INDEX IF NOT EXISTS short_term_batches_tenant_course_status_idx ON academic.short_term_batches (tenant_id, course_id, status);

CREATE TABLE IF NOT EXISTS academic.short_term_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES academic.short_term_batches(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPLIED',
  demand_id UUID,
  payment_id UUID,
  waitlist_rank INT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, student_id)
);
CREATE INDEX IF NOT EXISTS short_term_enrollments_tenant_student_status_idx ON academic.short_term_enrollments (tenant_id, student_id, status);
CREATE INDEX IF NOT EXISTS short_term_enrollments_tenant_batch_status_idx ON academic.short_term_enrollments (tenant_id, batch_id, status);

CREATE TABLE IF NOT EXISTS academic.short_term_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES academic.short_term_batches(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, staff_user_id, role)
);
CREATE INDEX IF NOT EXISTS short_term_staff_tenant_batch_idx ON academic.short_term_staff_assignments (tenant_id, batch_id);

CREATE TABLE IF NOT EXISTS academic.short_term_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES academic.short_term_batches(id) ON DELETE CASCADE,
  topic TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  venue TEXT,
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS short_term_sessions_tenant_batch_starts_idx ON academic.short_term_sessions (tenant_id, batch_id, starts_at);

CREATE TABLE IF NOT EXISTS academic.short_term_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES academic.short_term_sessions(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES academic.short_term_enrollments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PRESENT',
  marked_by_id UUID,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, enrollment_id)
);
CREATE INDEX IF NOT EXISTS short_term_attendance_tenant_enrollment_idx ON academic.short_term_attendance (tenant_id, enrollment_id);

CREATE TABLE IF NOT EXISTS academic.short_term_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES academic.short_term_batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'NOTES',
  file_path TEXT,
  file_url TEXT,
  published_at TIMESTAMPTZ,
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS short_term_materials_tenant_batch_idx ON academic.short_term_materials (tenant_id, batch_id);

CREATE TABLE IF NOT EXISTS academic.short_term_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES academic.short_term_batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ASSIGNMENT',
  max_marks DECIMAL(8,2) NOT NULL DEFAULT 100,
  pass_marks DECIMAL(8,2) NOT NULL DEFAULT 40,
  weightage DECIMAL(8,2) NOT NULL DEFAULT 100,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS short_term_assessments_tenant_batch_idx ON academic.short_term_assessments (tenant_id, batch_id);

CREATE TABLE IF NOT EXISTS academic.short_term_assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  assessment_id UUID NOT NULL REFERENCES academic.short_term_assessments(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES academic.short_term_enrollments(id) ON DELETE CASCADE,
  marks DECIMAL(8,2) NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  graded_by_id UUID,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, enrollment_id)
);
CREATE INDEX IF NOT EXISTS short_term_assessment_results_tenant_enrollment_idx ON academic.short_term_assessment_results (tenant_id, enrollment_id);

CREATE TABLE IF NOT EXISTS academic.short_term_certificate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  enrollment_id UUID NOT NULL UNIQUE REFERENCES academic.short_term_enrollments(id) ON DELETE CASCADE,
  certificate_issue_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS short_term_certificate_links_tenant_issue_idx ON academic.short_term_certificate_links (tenant_id, certificate_issue_id);
