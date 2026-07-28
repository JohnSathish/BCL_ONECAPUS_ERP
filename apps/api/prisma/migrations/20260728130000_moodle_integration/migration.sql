-- Moodle LMS integration tables + LMS provider fields

ALTER TABLE "academic"."lms_settings" ADD COLUMN IF NOT EXISTS "default_lms_provider" TEXT NOT NULL DEFAULT 'NATIVE';

ALTER TABLE "academic"."lms_workspaces" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'INHERIT';
ALTER TABLE "academic"."lms_workspaces" ADD COLUMN IF NOT EXISTS "moodle_course_id" INTEGER;

ALTER TABLE "academic"."students" ADD COLUMN IF NOT EXISTS "moodle_user_id" INTEGER;
CREATE INDEX IF NOT EXISTS "students_tenant_id_moodle_user_id_idx" ON "academic"."students"("tenant_id", "moodle_user_id");

ALTER TABLE "academic"."staff_profiles" ADD COLUMN IF NOT EXISTS "moodle_user_id" INTEGER;
CREATE INDEX IF NOT EXISTS "staff_profiles_tenant_id_moodle_user_id_idx" ON "academic"."staff_profiles"("tenant_id", "moodle_user_id");

CREATE TABLE IF NOT EXISTS "academic"."moodle_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "moodle_url" TEXT,
    "ws_token_encrypted" TEXT,
    "ws_service_name" TEXT,
    "sso_secret_encrypted" TEXT,
    "enable_sync" BOOLEAN NOT NULL DEFAULT false,
    "enable_auto_user_creation" BOOLEAN NOT NULL DEFAULT true,
    "enable_auto_course_creation" BOOLEAN NOT NULL DEFAULT true,
    "enable_auto_enrollment" BOOLEAN NOT NULL DEFAULT true,
    "enable_grade_sync" BOOLEAN NOT NULL DEFAULT true,
    "enable_attendance_sync" BOOLEAN NOT NULL DEFAULT true,
    "enable_assignment_sync" BOOLEAN NOT NULL DEFAULT true,
    "enable_notification_sync" BOOLEAN NOT NULL DEFAULT true,
    "sso_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cron_interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "connection_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "last_connection_at" TIMESTAMP(3),
    "last_connection_error" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "feature_flags" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moodle_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "moodle_settings_tenant_id_key" ON "academic"."moodle_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "academic"."moodle_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "erp_user_id" UUID NOT NULL,
    "erp_entity_type" TEXT NOT NULL,
    "erp_entity_id" UUID NOT NULL,
    "moodle_user_id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "sync_status" TEXT NOT NULL DEFAULT 'SYNCED',
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moodle_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "moodle_users_tenant_id_erp_user_id_key" ON "academic"."moodle_users"("tenant_id", "erp_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "moodle_users_tenant_id_moodle_user_id_key" ON "academic"."moodle_users"("tenant_id", "moodle_user_id");
CREATE INDEX IF NOT EXISTS "moodle_users_tenant_id_erp_entity_type_erp_entity_id_idx" ON "academic"."moodle_users"("tenant_id", "erp_entity_type", "erp_entity_id");

CREATE TABLE IF NOT EXISTS "academic"."moodle_courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_version_id" UUID,
    "semester_sequence" INTEGER,
    "course_offering_id" UUID,
    "lms_workspace_id" UUID,
    "moodle_course_id" INTEGER NOT NULL,
    "shortname" TEXT NOT NULL,
    "fullname" TEXT NOT NULL,
    "sync_status" TEXT NOT NULL DEFAULT 'SYNCED',
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moodle_courses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "moodle_courses_tenant_id_moodle_course_id_key" ON "academic"."moodle_courses"("tenant_id", "moodle_course_id");
CREATE INDEX IF NOT EXISTS "moodle_courses_tenant_id_program_version_id_semester_sequence_idx" ON "academic"."moodle_courses"("tenant_id", "program_version_id", "semester_sequence");
CREATE INDEX IF NOT EXISTS "moodle_courses_tenant_id_lms_workspace_id_idx" ON "academic"."moodle_courses"("tenant_id", "lms_workspace_id");

CREATE TABLE IF NOT EXISTS "academic"."moodle_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "moodle_user_id" UUID NOT NULL,
    "moodle_course_id" UUID NOT NULL,
    "moodle_enrol_id" INTEGER,
    "role" TEXT NOT NULL DEFAULT 'student',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moodle_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "moodle_enrollments_tenant_id_moodle_user_id_moodle_course_id_role_key" ON "academic"."moodle_enrollments"("tenant_id", "moodle_user_id", "moodle_course_id", "role");
CREATE INDEX IF NOT EXISTS "moodle_enrollments_tenant_id_status_idx" ON "academic"."moodle_enrollments"("tenant_id", "status");
ALTER TABLE "academic"."moodle_enrollments" ADD CONSTRAINT "moodle_enrollments_moodle_user_id_fkey" FOREIGN KEY ("moodle_user_id") REFERENCES "academic"."moodle_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."moodle_enrollments" ADD CONSTRAINT "moodle_enrollments_moodle_course_id_fkey" FOREIGN KEY ("moodle_course_id") REFERENCES "academic"."moodle_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."moodle_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "moodle_course_id" UUID NOT NULL,
    "moodle_assignment_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "max_grade" DECIMAL(8,2),
    "raw_payload" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moodle_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "moodle_assignments_tenant_id_moodle_assignment_id_key" ON "academic"."moodle_assignments"("tenant_id", "moodle_assignment_id");
ALTER TABLE "academic"."moodle_assignments" ADD CONSTRAINT "moodle_assignments_moodle_course_id_fkey" FOREIGN KEY ("moodle_course_id") REFERENCES "academic"."moodle_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."moodle_quizzes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "moodle_course_id" UUID NOT NULL,
    "moodle_quiz_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "time_open" TIMESTAMP(3),
    "time_close" TIMESTAMP(3),
    "raw_payload" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moodle_quizzes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "moodle_quizzes_tenant_id_moodle_quiz_id_key" ON "academic"."moodle_quizzes"("tenant_id", "moodle_quiz_id");
ALTER TABLE "academic"."moodle_quizzes" ADD CONSTRAINT "moodle_quizzes_moodle_course_id_fkey" FOREIGN KEY ("moodle_course_id") REFERENCES "academic"."moodle_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."moodle_grades" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "moodle_course_id" UUID NOT NULL,
    "moodle_user_id" INTEGER NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "grade_value" DECIMAL(8,2),
    "grade_max" DECIMAL(8,2),
    "raw_payload" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moodle_grades_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "moodle_grades_tenant_id_moodle_course_id_moodle_user_id_idx" ON "academic"."moodle_grades"("tenant_id", "moodle_course_id", "moodle_user_id");
ALTER TABLE "academic"."moodle_grades" ADD CONSTRAINT "moodle_grades_moodle_course_id_fkey" FOREIGN KEY ("moodle_course_id") REFERENCES "academic"."moodle_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."moodle_attendance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "moodle_course_id" UUID NOT NULL,
    "moodle_user_id" INTEGER NOT NULL,
    "session_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MOODLE',
    "raw_payload" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moodle_attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "moodle_attendance_tenant_id_moodle_course_id_moodle_user_id_session_date_key" ON "academic"."moodle_attendance"("tenant_id", "moodle_course_id", "moodle_user_id", "session_date");
ALTER TABLE "academic"."moodle_attendance" ADD CONSTRAINT "moodle_attendance_moodle_course_id_fkey" FOREIGN KEY ("moodle_course_id") REFERENCES "academic"."moodle_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."moodle_sync_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moodle_sync_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "moodle_sync_logs_tenant_id_sync_type_started_at_idx" ON "academic"."moodle_sync_logs"("tenant_id", "sync_type", "started_at");

CREATE TABLE IF NOT EXISTS "academic"."moodle_api_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ws_function" TEXT NOT NULL,
    "http_status" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "duration_ms" INTEGER,
    "request_meta" JSONB,
    "response_meta" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moodle_api_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "moodle_api_logs_tenant_id_created_at_idx" ON "academic"."moodle_api_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "moodle_api_logs_tenant_id_ws_function_idx" ON "academic"."moodle_api_logs"("tenant_id", "ws_function");

CREATE TABLE IF NOT EXISTS "academic"."moodle_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "erp_user_id" UUID,
    "moodle_user_id" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "read_at" TIMESTAMP(3),
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moodle_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "moodle_notifications_tenant_id_erp_user_id_created_at_idx" ON "academic"."moodle_notifications"("tenant_id", "erp_user_id", "created_at");

CREATE TABLE IF NOT EXISTS "academic"."moodle_sync_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "action" TEXT NOT NULL,
    "payload_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moodle_sync_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "moodle_sync_events_tenant_id_entity_type_status_created_at_idx" ON "academic"."moodle_sync_events"("tenant_id", "entity_type", "status", "created_at");
