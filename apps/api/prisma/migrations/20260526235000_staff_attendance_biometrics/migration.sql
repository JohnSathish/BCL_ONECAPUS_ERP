CREATE TABLE "academic"."staff_biometric_devices" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT 'eSSL X2008',
  "location" TEXT,
  "campus_id" UUID,
  "building" TEXT,
  "department_scope" JSONB,
  "connection_type" TEXT NOT NULL DEFAULT 'MIDDLEWARE',
  "ip_address" TEXT,
  "port" INTEGER,
  "device_password" TEXT,
  "communication_key" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "heartbeat_interval_sec" INTEGER NOT NULL DEFAULT 60,
  "sync_frequency_min" INTEGER NOT NULL DEFAULT 15,
  "status" TEXT NOT NULL DEFAULT 'SYNC_PENDING',
  "signal_health" TEXT,
  "last_seen_at" TIMESTAMP(3),
  "last_sync_at" TIMESTAMP(3),
  "last_heartbeat_at" TIMESTAMP(3),
  "user_count" INTEGER NOT NULL DEFAULT 0,
  "fingerprint_count" INTEGER NOT NULL DEFAULT 0,
  "firmware_version" TEXT,
  "diagnostics" JSONB,
  "settings" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "staff_biometric_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_biometric_mappings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "device_id" UUID,
  "biometric_id" TEXT NOT NULL,
  "device_user_id" TEXT NOT NULL,
  "sync_status" TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
  "enrollment_status" TEXT NOT NULL DEFAULT 'NOT_ENROLLED',
  "last_punch_at" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "conflict_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "disabled_at" TIMESTAMP(3),
  CONSTRAINT "staff_biometric_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_sync_batches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "device_id" UUID,
  "mode" TEXT NOT NULL DEFAULT 'INCREMENTAL',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "from_timestamp" TIMESTAMP(3),
  "to_timestamp" TIMESTAMP(3),
  "total_logs" INTEGER NOT NULL DEFAULT 0,
  "inserted_logs" INTEGER NOT NULL DEFAULT 0,
  "duplicate_logs" INTEGER NOT NULL DEFAULT 0,
  "failed_logs" INTEGER NOT NULL DEFAULT 0,
  "requested_by_id" UUID,
  "error_message" TEXT,
  "connector_meta" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_sync_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_raw_punches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "device_id" UUID,
  "staff_profile_id" UUID,
  "sync_batch_id" UUID,
  "device_user_id" TEXT NOT NULL,
  "biometric_id" TEXT,
  "punch_timestamp" TIMESTAMP(3) NOT NULL,
  "verification_mode" TEXT,
  "punch_direction" TEXT,
  "raw_payload" JSONB NOT NULL,
  "source_hash" TEXT NOT NULL,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "processing_status" TEXT NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "staff_attendance_raw_punches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_daily_records" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "attendance_date" DATE NOT NULL,
  "shift_id" UUID,
  "first_in_at" TIMESTAMP(3),
  "last_out_at" TIMESTAMP(3),
  "worked_minutes" INTEGER NOT NULL DEFAULT 0,
  "late_minutes" INTEGER NOT NULL DEFAULT 0,
  "early_minutes" INTEGER NOT NULL DEFAULT 0,
  "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ABSENT',
  "exception_flags" JSONB NOT NULL DEFAULT '[]',
  "source_punch_ids" JSONB NOT NULL DEFAULT '[]',
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remarks" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_daily_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_corrections" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "attendance_date" DATE NOT NULL,
  "correction_type" TEXT NOT NULL,
  "requested_in_at" TIMESTAMP(3),
  "requested_out_at" TIMESTAMP(3),
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requested_by_id" UUID,
  "approved_by_id" UUID,
  "approved_at" TIMESTAMP(3),
  "audit_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_corrections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_rules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "scope_type" TEXT NOT NULL DEFAULT 'GLOBAL',
  "scope_id" UUID,
  "duplicate_tolerance_min" INTEGER NOT NULL DEFAULT 5,
  "grace_late_min" INTEGER NOT NULL DEFAULT 0,
  "grace_early_min" INTEGER NOT NULL DEFAULT 0,
  "min_work_minutes" INTEGER NOT NULL DEFAULT 0,
  "half_day_minutes" INTEGER NOT NULL DEFAULT 0,
  "overtime_after_minutes" INTEGER NOT NULL DEFAULT 0,
  "auto_process" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_shift_attendance_rules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "shift_id" UUID,
  "shift_name" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "grace_late_min" INTEGER NOT NULL DEFAULT 0,
  "grace_early_min" INTEGER NOT NULL DEFAULT 0,
  "min_work_minutes" INTEGER NOT NULL DEFAULT 0,
  "half_day_minutes" INTEGER NOT NULL DEFAULT 0,
  "overtime_after_minutes" INTEGER NOT NULL DEFAULT 0,
  "cross_midnight" BOOLEAN NOT NULL DEFAULT false,
  "auto_close_time" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_shift_attendance_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_audit_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "actor_id" UUID,
  "device_id" UUID,
  "staff_profile_id" UUID,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID,
  "payload" JSONB,
  "result" TEXT NOT NULL DEFAULT 'SUCCESS',
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_biometric_devices_tenant_id_idx" ON "academic"."staff_biometric_devices"("tenant_id");
CREATE INDEX "staff_biometric_devices_campus_id_idx" ON "academic"."staff_biometric_devices"("campus_id");
CREATE INDEX "staff_biometric_devices_status_idx" ON "academic"."staff_biometric_devices"("status");
CREATE UNIQUE INDEX "staff_biometric_mappings_tenant_id_biometric_id_active_key" ON "academic"."staff_biometric_mappings"("tenant_id", "biometric_id", "active");
CREATE UNIQUE INDEX "staff_biometric_mappings_tenant_id_device_user_id_active_key" ON "academic"."staff_biometric_mappings"("tenant_id", "device_user_id", "active");
CREATE INDEX "staff_biometric_mappings_tenant_id_staff_profile_id_idx" ON "academic"."staff_biometric_mappings"("tenant_id", "staff_profile_id");
CREATE INDEX "staff_biometric_mappings_device_id_idx" ON "academic"."staff_biometric_mappings"("device_id");
CREATE INDEX "staff_attendance_sync_batches_tenant_id_created_at_idx" ON "academic"."staff_attendance_sync_batches"("tenant_id", "created_at");
CREATE INDEX "staff_attendance_sync_batches_device_id_created_at_idx" ON "academic"."staff_attendance_sync_batches"("device_id", "created_at");
CREATE INDEX "staff_attendance_sync_batches_status_idx" ON "academic"."staff_attendance_sync_batches"("status");
CREATE UNIQUE INDEX "staff_attendance_raw_punches_tenant_id_source_hash_key" ON "academic"."staff_attendance_raw_punches"("tenant_id", "source_hash");
CREATE INDEX "staff_attendance_raw_punches_tenant_id_punch_timestamp_idx" ON "academic"."staff_attendance_raw_punches"("tenant_id", "punch_timestamp");
CREATE INDEX "staff_attendance_raw_punches_device_id_punch_timestamp_idx" ON "academic"."staff_attendance_raw_punches"("device_id", "punch_timestamp");
CREATE INDEX "staff_attendance_raw_punches_staff_profile_id_punch_timestamp_idx" ON "academic"."staff_attendance_raw_punches"("staff_profile_id", "punch_timestamp");
CREATE INDEX "staff_attendance_raw_punches_processing_status_idx" ON "academic"."staff_attendance_raw_punches"("processing_status");
CREATE UNIQUE INDEX "staff_attendance_daily_records_tenant_id_staff_profile_id_attendance_date_key" ON "academic"."staff_attendance_daily_records"("tenant_id", "staff_profile_id", "attendance_date");
CREATE INDEX "staff_attendance_daily_records_tenant_id_attendance_date_idx" ON "academic"."staff_attendance_daily_records"("tenant_id", "attendance_date");
CREATE INDEX "staff_attendance_daily_records_status_idx" ON "academic"."staff_attendance_daily_records"("status");
CREATE INDEX "staff_attendance_corrections_tenant_id_attendance_date_idx" ON "academic"."staff_attendance_corrections"("tenant_id", "attendance_date");
CREATE INDEX "staff_attendance_corrections_staff_profile_id_attendance_date_idx" ON "academic"."staff_attendance_corrections"("staff_profile_id", "attendance_date");
CREATE INDEX "staff_attendance_corrections_status_idx" ON "academic"."staff_attendance_corrections"("status");
CREATE INDEX "staff_attendance_rules_tenant_id_active_idx" ON "academic"."staff_attendance_rules"("tenant_id", "active");
CREATE INDEX "staff_shift_attendance_rules_tenant_id_shift_id_idx" ON "academic"."staff_shift_attendance_rules"("tenant_id", "shift_id");
CREATE INDEX "staff_shift_attendance_rules_tenant_id_active_idx" ON "academic"."staff_shift_attendance_rules"("tenant_id", "active");
CREATE INDEX "staff_attendance_audit_logs_tenant_id_created_at_idx" ON "academic"."staff_attendance_audit_logs"("tenant_id", "created_at");
CREATE INDEX "staff_attendance_audit_logs_actor_id_created_at_idx" ON "academic"."staff_attendance_audit_logs"("actor_id", "created_at");
CREATE INDEX "staff_attendance_audit_logs_device_id_created_at_idx" ON "academic"."staff_attendance_audit_logs"("device_id", "created_at");

ALTER TABLE "academic"."staff_biometric_devices" ADD CONSTRAINT "staff_biometric_devices_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_biometric_mappings" ADD CONSTRAINT "staff_biometric_mappings_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_biometric_mappings" ADD CONSTRAINT "staff_biometric_mappings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "academic"."staff_biometric_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_attendance_sync_batches" ADD CONSTRAINT "staff_attendance_sync_batches_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "academic"."staff_biometric_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_attendance_raw_punches" ADD CONSTRAINT "staff_attendance_raw_punches_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "academic"."staff_biometric_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_attendance_raw_punches" ADD CONSTRAINT "staff_attendance_raw_punches_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_attendance_raw_punches" ADD CONSTRAINT "staff_attendance_raw_punches_sync_batch_id_fkey" FOREIGN KEY ("sync_batch_id") REFERENCES "academic"."staff_attendance_sync_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_attendance_daily_records" ADD CONSTRAINT "staff_attendance_daily_records_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."staff_attendance_audit_logs" ADD CONSTRAINT "staff_attendance_audit_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "academic"."staff_biometric_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
