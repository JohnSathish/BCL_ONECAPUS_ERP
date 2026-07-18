-- Campus Competitions Phase I: day-of meet volunteers

CREATE TABLE IF NOT EXISTS academic.competition_meet_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID NOT NULL REFERENCES academic.competition_meets(id) ON DELETE CASCADE,
  event_id UUID,
  person_type TEXT NOT NULL DEFAULT 'STAFF',
  staff_id UUID,
  student_id UUID,
  role TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  assigned_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS competition_meet_volunteers_tenant_meet_role_idx
  ON academic.competition_meet_volunteers (tenant_id, meet_id, role);

CREATE INDEX IF NOT EXISTS competition_meet_volunteers_tenant_event_idx
  ON academic.competition_meet_volunteers (tenant_id, event_id);
