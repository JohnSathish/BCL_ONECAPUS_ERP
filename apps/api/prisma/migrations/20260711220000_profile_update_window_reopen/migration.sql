-- Per-student reopen of the profile update window after the tenant window closes.

CREATE TABLE IF NOT EXISTS academic.student_profile_update_reopens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  reopen_until DATE NOT NULL,
  reason TEXT,
  created_by_id UUID,
  revoked_at TIMESTAMPTZ,
  revoked_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_profile_update_reopens_tenant_student_idx
  ON academic.student_profile_update_reopens (tenant_id, student_id);

CREATE INDEX IF NOT EXISTS student_profile_update_reopens_active_idx
  ON academic.student_profile_update_reopens (tenant_id, student_id, reopen_until)
  WHERE revoked_at IS NULL;
