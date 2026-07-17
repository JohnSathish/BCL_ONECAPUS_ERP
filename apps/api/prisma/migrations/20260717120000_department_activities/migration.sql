-- Department Activities / Seminars (Phase 1)
CREATE TABLE IF NOT EXISTS academic.department_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  department_id UUID NOT NULL REFERENCES core.departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  academic_year_id UUID,
  semester_sequence INT,
  venue TEXT NOT NULL DEFAULT '',
  event_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  registration_starts_at TIMESTAMPTZ,
  registration_ends_at TIMESTAMPTZ,
  coordinator_staff_id UUID,
  hod_staff_id UUID,
  guest_speaker TEXT NOT NULL DEFAULT '',
  chief_guest TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  learning_outcomes TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  poster_url TEXT,
  banner_url TEXT,
  brochure_url TEXT,
  max_participants INT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  attendance_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  attendance_finalized_at TIMESTAMPTZ,
  created_by_id UUID,
  approved_by_id UUID,
  approved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS department_activities_tenant_dept_status_idx
  ON academic.department_activities (tenant_id, department_id, status);
CREATE INDEX IF NOT EXISTS department_activities_tenant_event_date_idx
  ON academic.department_activities (tenant_id, event_date);
CREATE INDEX IF NOT EXISTS department_activities_tenant_type_idx
  ON academic.department_activities (tenant_id, activity_type);

CREATE TABLE IF NOT EXISTS academic.department_activity_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  activity_id UUID NOT NULL REFERENCES academic.department_activities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'REGISTERED',
  qr_pass_token TEXT NOT NULL UNIQUE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, student_id)
);
CREATE INDEX IF NOT EXISTS department_activity_registrations_tenant_student_idx
  ON academic.department_activity_registrations (tenant_id, student_id, status);
CREATE INDEX IF NOT EXISTS department_activity_registrations_tenant_activity_idx
  ON academic.department_activity_registrations (tenant_id, activity_id, status);

CREATE TABLE IF NOT EXISTS academic.department_activity_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  registration_id UUID NOT NULL UNIQUE REFERENCES academic.department_activity_registrations(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'MANUAL',
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS department_activity_attendance_tenant_marked_idx
  ON academic.department_activity_attendance (tenant_id, marked_at);

CREATE TABLE IF NOT EXISTS academic.department_activity_certificate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  activity_id UUID NOT NULL REFERENCES academic.department_activities(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL,
  certificate_issue_id UUID NOT NULL,
  certificate_type TEXT NOT NULL DEFAULT 'PARTICIPATION',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registration_id, certificate_type)
);
CREATE INDEX IF NOT EXISTS department_activity_certificate_links_tenant_activity_idx
  ON academic.department_activity_certificate_links (tenant_id, activity_id);
CREATE INDEX IF NOT EXISTS department_activity_certificate_links_tenant_issue_idx
  ON academic.department_activity_certificate_links (tenant_id, certificate_issue_id);
