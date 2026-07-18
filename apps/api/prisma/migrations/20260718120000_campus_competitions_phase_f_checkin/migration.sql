-- Campus Competitions Phase F: RFID/QR event check-in

ALTER TABLE academic.competition_events
  ADD COLUMN IF NOT EXISTS check_in_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS competition_events_check_in_token_uidx
  ON academic.competition_events (check_in_token)
  WHERE check_in_token IS NOT NULL;

ALTER TABLE academic.competition_entries
  ADD COLUMN IF NOT EXISTS qr_pass_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS competition_entries_qr_pass_token_uidx
  ON academic.competition_entries (qr_pass_token)
  WHERE qr_pass_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS academic.competition_entry_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entry_id UUID NOT NULL UNIQUE REFERENCES academic.competition_entries(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  method TEXT NOT NULL DEFAULT 'QR',
  scan_code TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS competition_entry_check_ins_tenant_event_marked_idx
  ON academic.competition_entry_check_ins (tenant_id, event_id, marked_at);
