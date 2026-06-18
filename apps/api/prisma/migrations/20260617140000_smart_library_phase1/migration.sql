-- Smart Library Phase 1 — circulation policies + book location fields

ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "circulation_policy" JSONB,
  ADD COLUMN IF NOT EXISTS "fine_policy" JSONB;

ALTER TABLE "library"."library_books"
  ADD COLUMN IF NOT EXISTS "section" TEXT,
  ADD COLUMN IF NOT EXISTS "row" TEXT;
