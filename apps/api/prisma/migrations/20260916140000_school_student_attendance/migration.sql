-- School SIS student attendance (schema school). Not college attendance tables.

CREATE TABLE IF NOT EXISTS "school"."school_attendance_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'DAILY',
    "default_status" TEXT NOT NULL DEFAULT 'PRESENT',
    "default_marking" TEXT NOT NULL DEFAULT 'ALL_PRESENT',
    "lock_enabled" BOOLEAN NOT NULL DEFAULT true,
    "lock_after_hours" INTEGER NOT NULL DEFAULT 24,
    "correction_required" BOOLEAN NOT NULL DEFAULT true,
    "min_percent" INTEGER NOT NULL DEFAULT 75,
    "warn_percent" INTEGER NOT NULL DEFAULT 85,
    "late_counts_present" BOOLEAN NOT NULL DEFAULT true,
    "half_day_value" DECIMAL(4,2) NOT NULL DEFAULT 0.5,
    "leave_counts_present" BOOLEAN NOT NULL DEFAULT false,
    "excused_counts_present" BOOLEAN NOT NULL DEFAULT true,
    "absent_notify" BOOLEAN NOT NULL DEFAULT true,
    "late_notify" BOOLEAN NOT NULL DEFAULT false,
    "low_attendance_notify" BOOLEAN NOT NULL DEFAULT true,
    "consecutive_absent_alert" INTEGER NOT NULL DEFAULT 3,
    "reminder_hour" INTEGER NOT NULL DEFAULT 10,
    "reminder_minute" INTEGER NOT NULL DEFAULT 0,
    "escalate_class_teacher_min" INTEGER NOT NULL DEFAULT 30,
    "escalate_admin_min" INTEGER NOT NULL DEFAULT 60,
    "late_threshold_min" INTEGER NOT NULL DEFAULT 10,
    "grace_period_min" INTEGER NOT NULL DEFAULT 10,
    "qr_enabled" BOOLEAN NOT NULL DEFAULT false,
    "geo_enabled" BOOLEAN NOT NULL DEFAULT false,
    "geo_radius_m" INTEGER NOT NULL DEFAULT 100,
    "geo_lat" DECIMAL(10,7),
    "geo_lng" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_attendance_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_attendance_settings_tenant_id_academic_year_id_key"
  ON "school"."school_attendance_settings"("tenant_id", "academic_year_id");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_statuses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "counts_present" BOOLEAN NOT NULL DEFAULT false,
    "counts_absent" BOOLEAN NOT NULL DEFAULT false,
    "counts_toward_pct" BOOLEAN NOT NULL DEFAULT true,
    "attendance_value" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "requires_remark" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_attendance_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_attendance_statuses_tenant_id_code_key"
  ON "school"."school_attendance_statuses"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "school_attendance_statuses_tenant_id_active_idx"
  ON "school"."school_attendance_statuses"("tenant_id", "active");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_leave_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "counts_as_present" BOOLEAN NOT NULL DEFAULT false,
    "requires_document" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_attendance_leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_attendance_leave_types_tenant_id_code_key"
  ON "school"."school_attendance_leave_types"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "section_id" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'DAILY',
    "period_key" TEXT NOT NULL DEFAULT 'DAILY',
    "subject_id" UUID,
    "staff_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3),
    "submitted_by" UUID,
    "locked_at" TIMESTAMP(3),
    "locked_by" UUID,
    "unlocked_at" TIMESTAMP(3),
    "unlocked_by" UUID,
    "unlock_reason" TEXT,
    "client_session_id" TEXT,
    "qr_token" TEXT,
    "qr_expires_at" TIMESTAMP(3),
    "geo_lat" DECIMAL(10,7),
    "geo_lng" DECIMAL(10,7),
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_attendance_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_att_sess_natural_key"
  ON "school"."school_attendance_sessions"("tenant_id", "academic_year_id", "date", "section_id", "mode", "period_key");
CREATE UNIQUE INDEX IF NOT EXISTS "school_att_sess_client_key"
  ON "school"."school_attendance_sessions"("tenant_id", "client_session_id");
CREATE INDEX IF NOT EXISTS "school_att_sess_date_idx"
  ON "school"."school_attendance_sessions"("tenant_id", "date", "status");
CREATE INDEX IF NOT EXISTS "school_att_sess_section_idx"
  ON "school"."school_attendance_sessions"("tenant_id", "section_id", "date");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3),
    "marked_by" UUID,
    "remark" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "device_id" TEXT,
    "client_record_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_att_rec_session_student_key"
  ON "school"."school_attendance_records"("session_id", "student_id");
CREATE UNIQUE INDEX IF NOT EXISTS "school_att_rec_client_key"
  ON "school"."school_attendance_records"("tenant_id", "client_record_id");
CREATE INDEX IF NOT EXISTS "school_att_rec_student_idx"
  ON "school"."school_attendance_records"("tenant_id", "student_id", "status_code");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "record_id" UUID,
    "session_id" UUID,
    "student_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT,
    "reason" TEXT,
    "ip_address" TEXT,
    "device_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_att_audit_created_idx"
  ON "school"."school_attendance_audit_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "school_att_audit_student_idx"
  ON "school"."school_attendance_audit_logs"("tenant_id", "student_id", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_leaves" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "reason" TEXT,
    "document_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_attendance_leaves_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_att_leave_student_idx"
  ON "school"."school_attendance_leaves"("tenant_id", "student_id", "from_date", "to_date");
CREATE INDEX IF NOT EXISTS "school_att_leave_status_idx"
  ON "school"."school_attendance_leaves"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_corrections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_by" UUID NOT NULL,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_attendance_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_att_corr_status_idx"
  ON "school"."school_attendance_corrections"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_notify_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "student_id" UUID,
    "session_id" UUID,
    "superseded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_attendance_notify_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_att_notify_key"
  ON "school"."school_attendance_notify_events"("tenant_id", "event_key");
CREATE INDEX IF NOT EXISTS "school_att_notify_student_idx"
  ON "school"."school_attendance_notify_events"("tenant_id", "student_id", "event_type");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_substitutes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "staff_id" UUID NOT NULL,
    "original_staff_id" UUID,
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_attendance_substitutes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_att_sub_key"
  ON "school"."school_attendance_substitutes"("tenant_id", "section_id", "date", "staff_id");
CREATE INDEX IF NOT EXISTS "school_att_sub_staff_idx"
  ON "school"."school_attendance_substitutes"("tenant_id", "staff_id", "date");

CREATE TABLE IF NOT EXISTS "school"."school_attendance_sync_queue" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "client_record_id" TEXT NOT NULL,
    "server_record_id" UUID,
    "server_session_id" UUID,
    "sync_status" TEXT NOT NULL DEFAULT 'PENDING',
    "conflict_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    CONSTRAINT "school_attendance_sync_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_att_sync_client_key"
  ON "school"."school_attendance_sync_queue"("tenant_id", "client_record_id");
CREATE INDEX IF NOT EXISTS "school_att_sync_device_idx"
  ON "school"."school_attendance_sync_queue"("tenant_id", "device_id", "sync_status");

ALTER TABLE "school"."school_attendance_settings"
  ADD CONSTRAINT "school_attendance_settings_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school"."school_attendance_sessions"
  ADD CONSTRAINT "school_attendance_sessions_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_attendance_sessions"
  ADD CONSTRAINT "school_attendance_sessions_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_attendance_sessions"
  ADD CONSTRAINT "school_attendance_sessions_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "school"."school_attendance_records"
  ADD CONSTRAINT "school_attendance_records_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "school"."school_attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_attendance_records"
  ADD CONSTRAINT "school_attendance_records_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_attendance_audit_logs"
  ADD CONSTRAINT "school_attendance_audit_logs_record_id_fkey"
  FOREIGN KEY ("record_id") REFERENCES "school"."school_attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "school"."school_attendance_leaves"
  ADD CONSTRAINT "school_attendance_leaves_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_attendance_leaves"
  ADD CONSTRAINT "school_attendance_leaves_leave_type_id_fkey"
  FOREIGN KEY ("leave_type_id") REFERENCES "school"."school_attendance_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_attendance_corrections"
  ADD CONSTRAINT "school_attendance_corrections_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "school"."school_attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_attendance_corrections"
  ADD CONSTRAINT "school_attendance_corrections_record_id_fkey"
  FOREIGN KEY ("record_id") REFERENCES "school"."school_attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_attendance_corrections"
  ADD CONSTRAINT "school_attendance_corrections_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school"."school_attendance_substitutes"
  ADD CONSTRAINT "school_attendance_substitutes_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_attendance_substitutes"
  ADD CONSTRAINT "school_attendance_substitutes_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_attendance_substitutes"
  ADD CONSTRAINT "school_attendance_substitutes_original_staff_id_fkey"
  FOREIGN KEY ("original_staff_id") REFERENCES "school"."school_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
