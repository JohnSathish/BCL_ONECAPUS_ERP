-- Department Activities Phase 2: results, presentations, media, report fields

ALTER TABLE academic.department_activities
  ADD COLUMN IF NOT EXISTS report_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS outcomes_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS feedback_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS calendar_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS naac_evidence_tagged_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS academic.department_activity_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  activity_id UUID NOT NULL REFERENCES academic.department_activities(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL UNIQUE REFERENCES academic.department_activity_registrations(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  remarks TEXT NOT NULL DEFAULT '',
  recorded_by_id UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS department_activity_results_tenant_activity_pos_idx
  ON academic.department_activity_results (tenant_id, activity_id, position);

CREATE TABLE IF NOT EXISTS academic.department_activity_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  activity_id UUID NOT NULL REFERENCES academic.department_activities(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL UNIQUE REFERENCES academic.department_activity_registrations(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  abstract_text TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  supervisor TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  reviewed_by_id UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS department_activity_presentations_tenant_activity_status_idx
  ON academic.department_activity_presentations (tenant_id, activity_id, status);

CREATE TABLE IF NOT EXISTS academic.department_activity_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  activity_id UUID NOT NULL REFERENCES academic.department_activities(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  uploaded_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS department_activity_media_tenant_activity_type_idx
  ON academic.department_activity_media (tenant_id, activity_id, media_type);
