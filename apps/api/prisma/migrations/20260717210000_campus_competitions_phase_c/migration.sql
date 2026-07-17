-- Campus Competitions Phase C: live display + announcements + approval flag

ALTER TABLE academic.competition_meets
  ADD COLUMN IF NOT EXISTS display_token TEXT,
  ADD COLUMN IF NOT EXISTS live_event_id UUID,
  ADD COLUMN IF NOT EXISTS require_result_approval BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS competition_meets_display_token_uidx
  ON academic.competition_meets (display_token)
  WHERE display_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS academic.competition_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  meet_id UUID NOT NULL REFERENCES academic.competition_meets(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO',
  created_by_id UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_announcements_tenant_meet_created_idx
  ON academic.competition_announcements (tenant_id, meet_id, created_at);
