-- BCL Smart Library Phase 6 — AI assistant + RFID/biometric entry hooks

ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "assistant_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "rfid_entry_enabled" BOOLEAN NOT NULL DEFAULT true;
