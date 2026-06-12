-- Biometric attendance device integration fields on staff profiles

ALTER TABLE "academic"."staff_profiles"
  ADD COLUMN IF NOT EXISTS "biometric_device_id" TEXT,
  ADD COLUMN IF NOT EXISTS "biometric_sync_status" TEXT,
  ADD COLUMN IF NOT EXISTS "biometric_last_sync_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "biometric_external_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "staff_profiles_tenant_id_biometric_id_idx"
  ON "academic"."staff_profiles"("tenant_id", "biometric_id");
