ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "access_desk_settings" JSONB;
