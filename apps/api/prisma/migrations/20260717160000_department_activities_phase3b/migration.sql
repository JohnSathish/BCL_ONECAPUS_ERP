-- Department Activities Phase 3B: cert integrity + achievement shares

ALTER TABLE academic.certificate_issues
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS integrity_signature TEXT;

CREATE TABLE IF NOT EXISTS academic.department_activity_achievement_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  certificate_link_id UUID NOT NULL REFERENCES academic.department_activity_certificate_links(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'UNLISTED',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS department_activity_achievement_shares_tenant_student_idx
  ON academic.department_activity_achievement_shares (tenant_id, student_id);
CREATE INDEX IF NOT EXISTS department_activity_achievement_shares_tenant_link_idx
  ON academic.department_activity_achievement_shares (tenant_id, certificate_link_id);
