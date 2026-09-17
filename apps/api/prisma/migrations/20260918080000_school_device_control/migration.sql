-- St. Luke's school SIS device control (schema school). Extends mobile devices; no tokens in admin APIs.

ALTER TABLE "school"."school_mobile_devices"
  ADD COLUMN IF NOT EXISTS "manufacturer" TEXT,
  ADD COLUMN IF NOT EXISTS "device_name" TEXT,
  ADD COLUMN IF NOT EXISTS "build_number" TEXT,
  ADD COLUMN IF NOT EXISTS "screen_resolution" TEXT,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "locale" TEXT,
  ADD COLUMN IF NOT EXISTS "network_type" TEXT,
  ADD COLUMN IF NOT EXISTS "last_ip_address" TEXT,
  ADD COLUMN IF NOT EXISTS "previous_ip_address" TEXT,
  ADD COLUMN IF NOT EXISTS "device_status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "push_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "biometric_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_logout_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_push_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failed_auth_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "flagged_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "flag_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "revoked_by" TEXT,
  ADD COLUMN IF NOT EXISTS "revoke_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "blocked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "blocked_by" TEXT,
  ADD COLUMN IF NOT EXISTS "block_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "signed_out_at" TIMESTAMP(3);

UPDATE "school"."school_mobile_devices"
SET "device_status" = 'REVOKED'
WHERE "revoked_at" IS NOT NULL AND "device_status" = 'ACTIVE';

UPDATE "school"."school_mobile_devices"
SET "push_enabled" = true
WHERE "push_token" IS NOT NULL AND "push_token" <> '';

CREATE INDEX IF NOT EXISTS "school_mobile_devices_tenant_id_device_status_idx"
  ON "school"."school_mobile_devices"("tenant_id", "device_status");
CREATE INDEX IF NOT EXISTS "school_mobile_devices_tenant_id_platform_idx"
  ON "school"."school_mobile_devices"("tenant_id", "platform");
CREATE INDEX IF NOT EXISTS "school_mobile_devices_tenant_id_last_active_at_idx"
  ON "school"."school_mobile_devices"("tenant_id", "last_active_at");

CREATE TABLE IF NOT EXISTS "school"."school_device_ip_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_row_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ip_address" TEXT NOT NULL,
    "network_type" TEXT,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_device_ip_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_device_ip_history_tenant_device_obs_idx"
  ON "school"."school_device_ip_history"("tenant_id", "device_row_id", "observed_at");

CREATE TABLE IF NOT EXISTS "school"."school_device_security_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_row_id" UUID,
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ip_address" TEXT,
    "performed_by" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_device_security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_device_security_events_tenant_created_idx"
  ON "school"."school_device_security_events"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "school_device_security_events_tenant_user_created_idx"
  ON "school"."school_device_security_events"("tenant_id", "user_id", "created_at");
CREATE INDEX IF NOT EXISTS "school_device_security_events_tenant_device_created_idx"
  ON "school"."school_device_security_events"("tenant_id", "device_row_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_device_ip_history_device_row_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_device_ip_history"
      ADD CONSTRAINT "school_device_ip_history_device_row_id_fkey"
      FOREIGN KEY ("device_row_id") REFERENCES "school"."school_mobile_devices"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_device_security_events_device_row_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_device_security_events"
      ADD CONSTRAINT "school_device_security_events_device_row_id_fkey"
      FOREIGN KEY ("device_row_id") REFERENCES "school"."school_mobile_devices"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
