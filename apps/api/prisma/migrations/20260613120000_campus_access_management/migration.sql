-- Campus Access Management System (CAMS)

CREATE SCHEMA IF NOT EXISTS "access";

CREATE TABLE "access"."access_points" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "access_type" TEXT NOT NULL,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "block_on_fine" BOOLEAN NOT NULL DEFAULT false,
    "block_inactive" BOOLEAN NOT NULL DEFAULT true,
    "attendance_mode" BOOLEAN NOT NULL DEFAULT false,
    "voice_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "access_points_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_points_tenant_id_code_key" ON "access"."access_points"("tenant_id", "code");
CREATE INDEX "access_points_tenant_id_active_idx" ON "access"."access_points"("tenant_id", "active");

CREATE TABLE "access"."access_kiosk_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "access_point_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_kiosk_devices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_kiosk_devices_tenant_id_access_point_id_idx" ON "access"."access_kiosk_devices"("tenant_id", "access_point_id");
CREATE INDEX "access_kiosk_devices_token_hash_idx" ON "access"."access_kiosk_devices"("token_hash");

ALTER TABLE "access"."access_kiosk_devices"
    ADD CONSTRAINT "access_kiosk_devices_access_point_id_fkey"
    FOREIGN KEY ("access_point_id") REFERENCES "access"."access_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "access"."entry_exit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "access_point_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "denial_reason" TEXT,
    "member_type" TEXT NOT NULL,
    "student_id" UUID,
    "staff_profile_id" UUID,
    "visitor_id" UUID,
    "display_name" TEXT NOT NULL,
    "enrollment_number" TEXT,
    "programme" TEXT,
    "department" TEXT,
    "scan_code" TEXT NOT NULL,
    "entry_method" TEXT,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "entry_exit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "entry_exit_logs_tenant_id_access_point_id_scanned_at_idx" ON "access"."entry_exit_logs"("tenant_id", "access_point_id", "scanned_at");
CREATE INDEX "entry_exit_logs_tenant_id_scanned_at_idx" ON "access"."entry_exit_logs"("tenant_id", "scanned_at");
CREATE INDEX "entry_exit_logs_tenant_id_student_id_idx" ON "access"."entry_exit_logs"("tenant_id", "student_id");

ALTER TABLE "access"."entry_exit_logs"
    ADD CONSTRAINT "entry_exit_logs_access_point_id_fkey"
    FOREIGN KEY ("access_point_id") REFERENCES "access"."access_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "access"."visitor_passes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "access_point_id" UUID,
    "pass_number" TEXT NOT NULL,
    "visitor_name" TEXT NOT NULL,
    "purpose" TEXT,
    "whom_to_meet" TEXT,
    "mobile" TEXT,
    "valid_till" TIMESTAMP(3) NOT NULL,
    "qr_payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_passes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visitor_passes_tenant_id_pass_number_key" ON "access"."visitor_passes"("tenant_id", "pass_number");
CREATE INDEX "visitor_passes_tenant_id_status_idx" ON "access"."visitor_passes"("tenant_id", "status");

ALTER TABLE "access"."visitor_passes"
    ADD CONSTRAINT "visitor_passes_access_point_id_fkey"
    FOREIGN KEY ("access_point_id") REFERENCES "access"."access_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
