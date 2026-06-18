CREATE TABLE "academic"."staff_attendance_master_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "attendance_year_start_month" INTEGER NOT NULL DEFAULT 4,
  "attendance_year_start_day" INTEGER NOT NULL DEFAULT 1,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "time_format" TEXT NOT NULL DEFAULT '24H',
  "working_week" JSONB NOT NULL DEFAULT '["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"]',
  "weekend_configuration" JSONB NOT NULL DEFAULT '{"SUNDAY":"FULL_DAY"}',
  "academic_session_linking" TEXT NOT NULL DEFAULT 'OPTIONAL',
  "multi_campus_mode" TEXT NOT NULL DEFAULT 'ENABLED',
  "shift_calculation_mode" TEXT NOT NULL DEFAULT 'ASSIGNMENT_PRIORITY',
  "punch_processing_mode" TEXT NOT NULL DEFAULT 'FIRST_IN_LAST_OUT',
  "min_punch_difference_min" INTEGER NOT NULL DEFAULT 5,
  "duplicate_suppression_min" INTEGER NOT NULL DEFAULT 5,
  "punch_merge_window_min" INTEGER NOT NULL DEFAULT 15,
  "missing_in_handling" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "missing_out_handling" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "auto_close_open_sessions" BOOLEAN NOT NULL DEFAULT true,
  "rounding_configuration" JSONB NOT NULL DEFAULT '{}',
  "no_shift_assigned_handling" TEXT NOT NULL DEFAULT 'MARK_PENDING_REVIEW',
  "device_identity_strategy" TEXT NOT NULL DEFAULT 'BIOMETRIC_ID',
  "backup_enabled" BOOLEAN NOT NULL DEFAULT false,
  "backup_frequency" TEXT NOT NULL DEFAULT 'DAILY',
  "archive_policy" TEXT NOT NULL DEFAULT 'YEARLY',
  "raw_log_retention_days" INTEGER NOT NULL DEFAULT 365,
  "failed_sync_retention_days" INTEGER NOT NULL DEFAULT 90,
  "auto_cleanup_enabled" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_master_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_shift_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "shift_id" UUID,
  "name" TEXT NOT NULL,
  "short_code" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "color_tag" TEXT,
  "shift_category" TEXT NOT NULL DEFAULT 'REGULAR',
  "begin_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "cross_midnight" BOOLEAN NOT NULL DEFAULT false,
  "night_shift" BOOLEAN NOT NULL DEFAULT false,
  "flexible" BOOLEAN NOT NULL DEFAULT false,
  "flexible_start_window_min" INTEGER NOT NULL DEFAULT 0,
  "flexible_end_window_min" INTEGER NOT NULL DEFAULT 0,
  "allowed_arrival_from" TEXT,
  "allowed_arrival_to" TEXT,
  "allowed_exit_from" TEXT,
  "allowed_exit_to" TEXT,
  "punch_begin_before_min" INTEGER NOT NULL DEFAULT 120,
  "punch_end_after_min" INTEGER NOT NULL DEFAULT 240,
  "early_arrival_window_min" INTEGER NOT NULL DEFAULT 0,
  "late_punch_cutoff_min" INTEGER NOT NULL DEFAULT 0,
  "late_grace_min" INTEGER NOT NULL DEFAULT 0,
  "early_exit_grace_min" INTEGER NOT NULL DEFAULT 0,
  "lunch_grace_min" INTEGER NOT NULL DEFAULT 0,
  "min_work_minutes" INTEGER NOT NULL DEFAULT 240,
  "half_day_minutes" INTEGER NOT NULL DEFAULT 240,
  "full_day_minutes" INTEGER NOT NULL DEFAULT 420,
  "saturday_half_day" BOOLEAN NOT NULL DEFAULT false,
  "saturday_half_day_end_time" TEXT,
  "ot_eligible" BOOLEAN NOT NULL DEFAULT false,
  "min_ot_threshold_min" INTEGER NOT NULL DEFAULT 0,
  "ot_approval_required" BOOLEAN NOT NULL DEFAULT true,
  "ot_rounding_rule" TEXT NOT NULL DEFAULT 'NONE',
  "max_daily_ot_min" INTEGER NOT NULL DEFAULT 0,
  "settings" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_shift_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_shift_breaks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "shift_rule_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "begin_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_shift_breaks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_shift_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "default_shift_rule_id" UUID,
  "default_rule_id" UUID,
  "default_ot_rule_id" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_shift_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_shift_calendars" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID,
  "department_id" UUID,
  "shift_group_id" UUID,
  "shift_rule_id" UUID,
  "calendar_date" DATE NOT NULL,
  "calendar_type" TEXT NOT NULL DEFAULT 'DAILY',
  "academic_term_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'WORKING_DAY',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_shift_calendars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_shift_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "scope_type" TEXT NOT NULL,
  "scope_id" UUID,
  "staff_profile_id" UUID,
  "department_id" UUID,
  "category_id" UUID,
  "shift_rule_id" UUID,
  "shift_group_id" UUID,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_shift_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_leave_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "yearly_limit" DECIMAL(6,2),
  "carry_forward_limit" DECIMAL(6,2),
  "encashment_enabled" BOOLEAN NOT NULL DEFAULT false,
  "gender_restriction" TEXT,
  "attachment_required" BOOLEAN NOT NULL DEFAULT false,
  "approval_flow" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_leave_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_employee_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "default_shift_rule_id" UUID,
  "grace_rules" JSONB,
  "leave_eligibility" JSONB,
  "ot_eligible" BOOLEAN NOT NULL DEFAULT false,
  "attendance_policy" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_employee_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_public_holidays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "holiday_date" DATE NOT NULL,
  "holiday_type" TEXT NOT NULL DEFAULT 'INSTITUTION',
  "scope_type" TEXT NOT NULL DEFAULT 'INSTITUTION',
  "campus_id" UUID,
  "department_ids" JSONB,
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_public_holidays_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_department_attendance_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "rule_type" TEXT NOT NULL DEFAULT 'FIXED_SHIFT',
  "shift_rule_id" UUID,
  "shift_group_id" UUID,
  "grace_rules" JSONB,
  "processing_rules" JSONB,
  "ot_rule_id" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_department_attendance_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_overtime_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "eligible" BOOLEAN NOT NULL DEFAULT false,
  "min_threshold_min" INTEGER NOT NULL DEFAULT 0,
  "regular_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  "holiday_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  "weekend_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.50,
  "approval_required" BOOLEAN NOT NULL DEFAULT true,
  "rounding_rule" TEXT NOT NULL DEFAULT 'NONE',
  "max_daily_ot_min" INTEGER NOT NULL DEFAULT 0,
  "department_overrides" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_overtime_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_attendance_processing_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'MANUAL',
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "scope_type" TEXT NOT NULL DEFAULT 'ALL',
  "staff_profile_id" UUID,
  "department_id" UUID,
  "from_date" DATE,
  "to_date" DATE,
  "requested_by_id" UUID,
  "processed_punches" INTEGER NOT NULL DEFAULT 0,
  "generated_records" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_attendance_processing_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_attendance_master_settings_tenant_id_key" ON "academic"."staff_attendance_master_settings"("tenant_id");
CREATE UNIQUE INDEX "staff_attendance_shift_rules_tenant_short_code_key" ON "academic"."staff_attendance_shift_rules"("tenant_id", "short_code");
CREATE INDEX "staff_attendance_shift_rules_tenant_active_idx" ON "academic"."staff_attendance_shift_rules"("tenant_id", "active");
CREATE INDEX "staff_attendance_shift_rules_shift_id_idx" ON "academic"."staff_attendance_shift_rules"("shift_id");
CREATE INDEX "staff_attendance_shift_breaks_tenant_shift_rule_idx" ON "academic"."staff_attendance_shift_breaks"("tenant_id", "shift_rule_id");
CREATE UNIQUE INDEX "staff_attendance_shift_groups_tenant_code_key" ON "academic"."staff_attendance_shift_groups"("tenant_id", "code");
CREATE INDEX "staff_attendance_shift_groups_tenant_active_idx" ON "academic"."staff_attendance_shift_groups"("tenant_id", "active");
CREATE INDEX "staff_attendance_shift_calendars_tenant_date_idx" ON "academic"."staff_attendance_shift_calendars"("tenant_id", "calendar_date");
CREATE INDEX "staff_attendance_shift_calendars_campus_date_idx" ON "academic"."staff_attendance_shift_calendars"("campus_id", "calendar_date");
CREATE INDEX "staff_attendance_shift_calendars_department_date_idx" ON "academic"."staff_attendance_shift_calendars"("department_id", "calendar_date");
CREATE INDEX "staff_attendance_shift_assignments_scope_idx" ON "academic"."staff_attendance_shift_assignments"("tenant_id", "scope_type", "scope_id");
CREATE INDEX "staff_attendance_shift_assignments_staff_active_idx" ON "academic"."staff_attendance_shift_assignments"("staff_profile_id", "active");
CREATE INDEX "staff_attendance_shift_assignments_department_active_idx" ON "academic"."staff_attendance_shift_assignments"("department_id", "active");
CREATE INDEX "staff_attendance_shift_assignments_category_active_idx" ON "academic"."staff_attendance_shift_assignments"("category_id", "active");
CREATE UNIQUE INDEX "staff_leave_types_tenant_code_key" ON "academic"."staff_leave_types"("tenant_id", "code");
CREATE INDEX "staff_leave_types_tenant_active_idx" ON "academic"."staff_leave_types"("tenant_id", "active");
CREATE UNIQUE INDEX "staff_employee_categories_tenant_code_key" ON "academic"."staff_employee_categories"("tenant_id", "code");
CREATE INDEX "staff_employee_categories_tenant_active_idx" ON "academic"."staff_employee_categories"("tenant_id", "active");
CREATE INDEX "staff_public_holidays_tenant_date_idx" ON "academic"."staff_public_holidays"("tenant_id", "holiday_date");
CREATE INDEX "staff_public_holidays_campus_date_idx" ON "academic"."staff_public_holidays"("campus_id", "holiday_date");
CREATE UNIQUE INDEX "staff_department_attendance_rules_tenant_department_active_key" ON "academic"."staff_department_attendance_rules"("tenant_id", "department_id", "active");
CREATE INDEX "staff_department_attendance_rules_tenant_active_idx" ON "academic"."staff_department_attendance_rules"("tenant_id", "active");
CREATE UNIQUE INDEX "staff_overtime_rules_tenant_code_key" ON "academic"."staff_overtime_rules"("tenant_id", "code");
CREATE INDEX "staff_overtime_rules_tenant_active_idx" ON "academic"."staff_overtime_rules"("tenant_id", "active");
CREATE INDEX "staff_attendance_processing_runs_tenant_created_idx" ON "academic"."staff_attendance_processing_runs"("tenant_id", "created_at");
CREATE INDEX "staff_attendance_processing_runs_status_idx" ON "academic"."staff_attendance_processing_runs"("status");

ALTER TABLE "academic"."staff_attendance_shift_breaks"
  ADD CONSTRAINT "staff_attendance_shift_breaks_shift_rule_id_fkey"
  FOREIGN KEY ("shift_rule_id") REFERENCES "academic"."staff_attendance_shift_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ BEGIN
  ALTER TABLE "academic"."staff_leave_balances"
    ADD CONSTRAINT "staff_leave_balances_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "academic"."staff_leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."staff_leave_applications"
    ADD CONSTRAINT "staff_leave_applications_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "academic"."staff_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
