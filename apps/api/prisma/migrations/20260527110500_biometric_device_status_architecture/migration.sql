ALTER TABLE "academic"."staff_biometric_devices"
  ADD COLUMN "registration_status" TEXT NOT NULL DEFAULT 'CONFIGURED',
  ADD COLUMN "network_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "authentication_status" TEXT NOT NULL DEFAULT 'NOT_TESTED',
  ADD COLUMN "sync_health_status" TEXT NOT NULL DEFAULT 'NEVER_SYNCED',
  ADD COLUMN "last_online_at" TIMESTAMP(3),
  ADD COLUMN "last_offline_at" TIMESTAMP(3),
  ADD COLUMN "last_successful_sync_at" TIMESTAMP(3),
  ADD COLUMN "last_failed_sync_at" TIMESTAMP(3),
  ADD COLUMN "failure_reason" TEXT,
  ADD COLUMN "uptime_percent" DECIMAL(5,2),
  ADD COLUMN "last_diagnostic_at" TIMESTAMP(3),
  ADD COLUMN "last_diagnostic_payload" JSONB;

CREATE INDEX "staff_biometric_devices_network_status_idx" ON "academic"."staff_biometric_devices"("network_status");
CREATE INDEX "staff_biometric_devices_authentication_status_idx" ON "academic"."staff_biometric_devices"("authentication_status");
CREATE INDEX "staff_biometric_devices_sync_health_status_idx" ON "academic"."staff_biometric_devices"("sync_health_status");
