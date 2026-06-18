CREATE TABLE "academic"."student_attendance_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID,
    "semester_id" UUID,
    "semester_no" INTEGER,
    "program_version_id" UUID,
    "offering_section_id" UUID,
    "course_id" UUID,
    "shift_id" UUID,
    "classroom_id" UUID,
    "timetable_plan_entry_id" UUID,
    "session_date" DATE NOT NULL,
    "day_of_week" INTEGER,
    "period_no" INTEGER,
    "start_time" TIME(0),
    "end_time" TIME(0),
    "session_type" TEXT NOT NULL DEFAULT 'THEORY',
    "lab_batch" TEXT,
    "faculty_mode" TEXT NOT NULL DEFAULT 'PRIMARY',
    "primary_faculty_id" UUID,
    "teaching_subject_group_id" UUID,
    "marked_by_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lock_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "frozen_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "student_attendance_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."student_attendance_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'P',
    "minutes_present" INTEGER,
    "remarks" TEXT,
    "marked_by_id" UUID,
    "marked_at" TIMESTAMP(3),
    "corrected_by_id" UUID,
    "corrected_at" TIMESTAMP(3),
    "correction_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_attendance_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."student_attendance_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID,
    "offering_section_id" UUID,
    "semester_no" INTEGER,
    "period_key" TEXT NOT NULL,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "present_count" INTEGER NOT NULL DEFAULT 0,
    "absent_count" INTEGER NOT NULL DEFAULT 0,
    "duty_leave_count" INTEGER NOT NULL DEFAULT 0,
    "medical_leave_count" INTEGER NOT NULL DEFAULT 0,
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_attendance_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."student_attendance_eligibility_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID,
    "offering_section_id" UUID,
    "semester_no" INTEGER,
    "subject_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "semester_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "eligibility_status" TEXT NOT NULL,
    "shortage_sessions" INTEGER NOT NULL DEFAULT 0,
    "required_sessions" INTEGER NOT NULL DEFAULT 0,
    "rule_applied" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_attendance_eligibility_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."student_attendance_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID,
    "session_id" UUID,
    "student_id" UUID,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "student_attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_attendance_sessions_tenant_id_timetable_plan_entry_id_session_date_key"
ON "academic"."student_attendance_sessions"("tenant_id", "timetable_plan_entry_id", "session_date");
CREATE INDEX "student_attendance_sessions_tenant_id_session_date_idx"
ON "academic"."student_attendance_sessions"("tenant_id", "session_date");
CREATE INDEX "student_attendance_sessions_tenant_id_offering_section_id_session_date_idx"
ON "academic"."student_attendance_sessions"("tenant_id", "offering_section_id", "session_date");
CREATE INDEX "student_attendance_sessions_tenant_id_course_id_semester_no_idx"
ON "academic"."student_attendance_sessions"("tenant_id", "course_id", "semester_no");
CREATE INDEX "student_attendance_sessions_tenant_id_primary_faculty_id_session_date_idx"
ON "academic"."student_attendance_sessions"("tenant_id", "primary_faculty_id", "session_date");
CREATE INDEX "student_attendance_sessions_tenant_id_status_idx"
ON "academic"."student_attendance_sessions"("tenant_id", "status");
CREATE INDEX "student_attendance_sessions_subject_group_idx"
ON "academic"."student_attendance_sessions"("tenant_id", "teaching_subject_group_id", "semester_no");

CREATE UNIQUE INDEX "student_attendance_entries_session_id_student_id_key"
ON "academic"."student_attendance_entries"("session_id", "student_id");
CREATE INDEX "student_attendance_entries_tenant_id_student_id_idx"
ON "academic"."student_attendance_entries"("tenant_id", "student_id");
CREATE INDEX "student_attendance_entries_tenant_id_status_idx"
ON "academic"."student_attendance_entries"("tenant_id", "status");
CREATE INDEX "student_attendance_entries_tenant_id_marked_at_idx"
ON "academic"."student_attendance_entries"("tenant_id", "marked_at");

CREATE UNIQUE INDEX "student_attendance_summaries_student_id_course_id_offering_section_id_semester_no_period_key_key"
ON "academic"."student_attendance_summaries"("student_id", "course_id", "offering_section_id", "semester_no", "period_key");
CREATE INDEX "student_attendance_summaries_tenant_id_student_id_idx"
ON "academic"."student_attendance_summaries"("tenant_id", "student_id");
CREATE INDEX "student_attendance_summaries_tenant_id_course_id_idx"
ON "academic"."student_attendance_summaries"("tenant_id", "course_id");
CREATE INDEX "student_attendance_summaries_tenant_id_semester_no_idx"
ON "academic"."student_attendance_summaries"("tenant_id", "semester_no");

CREATE INDEX "student_attendance_eligibility_snapshots_tenant_id_student_id_idx"
ON "academic"."student_attendance_eligibility_snapshots"("tenant_id", "student_id");
CREATE INDEX "student_attendance_eligibility_snapshots_tenant_id_semester_no_eligibility_status_idx"
ON "academic"."student_attendance_eligibility_snapshots"("tenant_id", "semester_no", "eligibility_status");
CREATE INDEX "student_attendance_eligibility_snapshots_tenant_id_course_id_idx"
ON "academic"."student_attendance_eligibility_snapshots"("tenant_id", "course_id");

CREATE INDEX "student_attendance_audit_logs_tenant_id_session_id_idx"
ON "academic"."student_attendance_audit_logs"("tenant_id", "session_id");
CREATE INDEX "student_attendance_audit_logs_tenant_id_student_id_idx"
ON "academic"."student_attendance_audit_logs"("tenant_id", "student_id");
CREATE INDEX "student_attendance_audit_logs_tenant_id_actor_id_idx"
ON "academic"."student_attendance_audit_logs"("tenant_id", "actor_id");
CREATE INDEX "student_attendance_audit_logs_tenant_id_action_idx"
ON "academic"."student_attendance_audit_logs"("tenant_id", "action");

ALTER TABLE "academic"."student_attendance_entries"
ADD CONSTRAINT "student_attendance_entries_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "academic"."student_attendance_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
