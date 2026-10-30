ALTER TABLE "library"."library_visits"
  ADD COLUMN IF NOT EXISTS "exit_method" TEXT;
