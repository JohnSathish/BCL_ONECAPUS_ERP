ALTER TABLE "academic"."staff_biometric_devices"
  ADD COLUMN "serial_number" TEXT,
  ADD COLUMN "device_code" TEXT,
  ADD COLUMN "floor" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "protocol" TEXT DEFAULT 'TCP/IP',
  ADD COLUMN "timeout_sec" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "ssl_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "device_key" TEXT,
  ADD COLUMN "machine_number" TEXT,
  ADD COLUMN "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_direction" TEXT NOT NULL DEFAULT 'DEVICE_TO_ERP',
  ADD COLUMN "punch_mode" TEXT NOT NULL DEFAULT 'IN_OUT',
  ADD COLUMN "duplicate_punch_threshold_min" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "time_drift_tolerance_sec" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "processing_strategy" TEXT NOT NULL DEFAULT 'FIRST_IN_LAST_OUT';

CREATE INDEX "staff_biometric_devices_device_code_idx" ON "academic"."staff_biometric_devices"("device_code");
CREATE INDEX "staff_biometric_devices_serial_number_idx" ON "academic"."staff_biometric_devices"("serial_number");
