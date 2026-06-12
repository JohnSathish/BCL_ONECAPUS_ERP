ALTER TABLE "academic"."timetable_entries"
  ADD COLUMN "timetable_plan_id" UUID,
  ADD COLUMN "timetable_plan_entry_id" UUID;

ALTER TABLE "academic"."attendance_sessions"
  ADD COLUMN "timetable_plan_id" UUID,
  ADD COLUMN "timetable_plan_entry_id" UUID;

CREATE TABLE "academic"."timetable_plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "institution_id" UUID,
  "campus_id" UUID,
  "academic_year_id" UUID,
  "department_id" UUID,
  "program_version_id" UUID,
  "semester_id" UUID,
  "semester_sequence" INTEGER,
  "shift_id" UUID,
  "name" TEXT NOT NULL,
  "scope_type" TEXT NOT NULL DEFAULT 'INSTITUTION',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approval_state" TEXT NOT NULL DEFAULT 'DRAFT',
  "effective_from" DATE,
  "effective_to" DATE,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "generated_at" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "approved_by_id" UUID,
  "published_by_id" UUID,
  "generation_summary" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "timetable_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."timetable_slot_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID,
  "shift_id" UUID,
  "day_of_week" INTEGER NOT NULL,
  "period_no" INTEGER NOT NULL DEFAULT 1,
  "label" TEXT NOT NULL,
  "start_time" TIME(0) NOT NULL,
  "end_time" TIME(0) NOT NULL,
  "duration_minutes" INTEGER NOT NULL DEFAULT 60,
  "is_break" BOOLEAN NOT NULL DEFAULT false,
  "is_lunch" BOOLEAN NOT NULL DEFAULT false,
  "is_saturday_half_day" BOOLEAN NOT NULL DEFAULT false,
  "allowed_categories" JSONB NOT NULL DEFAULT '[]',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetable_slot_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."timetable_plan_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "slot_template_id" UUID,
  "shift_id" UUID,
  "day_of_week" INTEGER NOT NULL,
  "period_no" INTEGER,
  "start_time" TIME(0) NOT NULL,
  "end_time" TIME(0) NOT NULL,
  "offering_section_id" UUID,
  "course_offering_id" UUID,
  "course_id" UUID,
  "staff_profile_id" UUID,
  "classroom_id" UUID,
  "semester_sequence" INTEGER,
  "section_code" TEXT,
  "slot_type" TEXT NOT NULL DEFAULT 'THEORY',
  "fyugp_category" TEXT,
  "combined_group_key" TEXT,
  "is_combined" BOOLEAN NOT NULL DEFAULT false,
  "is_locked" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "source" TEXT NOT NULL DEFAULT 'AUTO',
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "timetable_plan_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."timetable_conflicts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "entry_id" UUID,
  "conflict_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'ERROR',
  "message" TEXT NOT NULL,
  "affected_entity_type" TEXT,
  "affected_entity_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "timetable_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."timetable_substitutions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "original_entry_id" UUID,
  "new_entry_id" UUID,
  "action" TEXT NOT NULL,
  "substitute_staff_profile_id" UUID,
  "classroom_id" UUID,
  "session_date" DATE,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approved_by_id" UUID,
  "approved_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetable_substitutions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."timetable_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "entry_id" UUID,
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID,
  "before_state" JSONB,
  "after_state" JSONB,
  "rollback_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "timetable_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "timetable_entries_timetable_plan_entry_id_idx" ON "academic"."timetable_entries"("timetable_plan_entry_id");
CREATE INDEX "attendance_sessions_timetable_plan_entry_id_idx" ON "academic"."attendance_sessions"("timetable_plan_entry_id");
CREATE INDEX "timetable_plans_tenant_id_status_idx" ON "academic"."timetable_plans"("tenant_id", "status");
CREATE INDEX "timetable_plans_tenant_id_shift_id_idx" ON "academic"."timetable_plans"("tenant_id", "shift_id");
CREATE INDEX "timetable_plans_tenant_id_academic_year_id_idx" ON "academic"."timetable_plans"("tenant_id", "academic_year_id");
CREATE INDEX "timetable_plans_tenant_id_department_id_idx" ON "academic"."timetable_plans"("tenant_id", "department_id");
CREATE INDEX "timetable_plans_tenant_id_program_version_id_semester_sequence_idx" ON "academic"."timetable_plans"("tenant_id", "program_version_id", "semester_sequence");
CREATE INDEX "timetable_slot_templates_tenant_id_shift_id_day_of_week_idx" ON "academic"."timetable_slot_templates"("tenant_id", "shift_id", "day_of_week");
CREATE INDEX "timetable_slot_templates_plan_id_day_of_week_period_no_idx" ON "academic"."timetable_slot_templates"("plan_id", "day_of_week", "period_no");
CREATE INDEX "timetable_plan_entries_tenant_id_plan_id_idx" ON "academic"."timetable_plan_entries"("tenant_id", "plan_id");
CREATE INDEX "timetable_plan_entries_plan_id_day_of_week_start_time_idx" ON "academic"."timetable_plan_entries"("plan_id", "day_of_week", "start_time");
CREATE INDEX "timetable_plan_entries_tenant_id_staff_profile_id_day_of_week_idx" ON "academic"."timetable_plan_entries"("tenant_id", "staff_profile_id", "day_of_week");
CREATE INDEX "timetable_plan_entries_tenant_id_classroom_id_day_of_week_idx" ON "academic"."timetable_plan_entries"("tenant_id", "classroom_id", "day_of_week");
CREATE INDEX "timetable_plan_entries_tenant_id_offering_section_id_day_of_week_idx" ON "academic"."timetable_plan_entries"("tenant_id", "offering_section_id", "day_of_week");
CREATE INDEX "timetable_plan_entries_combined_group_key_idx" ON "academic"."timetable_plan_entries"("combined_group_key");
CREATE INDEX "timetable_conflicts_tenant_id_plan_id_status_idx" ON "academic"."timetable_conflicts"("tenant_id", "plan_id", "status");
CREATE INDEX "timetable_conflicts_conflict_type_idx" ON "academic"."timetable_conflicts"("conflict_type");
CREATE INDEX "timetable_substitutions_tenant_id_plan_id_idx" ON "academic"."timetable_substitutions"("tenant_id", "plan_id");
CREATE INDEX "timetable_substitutions_session_date_idx" ON "academic"."timetable_substitutions"("session_date");
CREATE INDEX "timetable_audit_logs_tenant_id_plan_id_created_at_idx" ON "academic"."timetable_audit_logs"("tenant_id", "plan_id", "created_at");
CREATE INDEX "timetable_audit_logs_actor_id_created_at_idx" ON "academic"."timetable_audit_logs"("actor_id", "created_at");

ALTER TABLE "academic"."timetable_slot_templates"
  ADD CONSTRAINT "timetable_slot_templates_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "academic"."timetable_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."timetable_plan_entries"
  ADD CONSTRAINT "timetable_plan_entries_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "academic"."timetable_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."timetable_conflicts"
  ADD CONSTRAINT "timetable_conflicts_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "academic"."timetable_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."timetable_substitutions"
  ADD CONSTRAINT "timetable_substitutions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "academic"."timetable_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."timetable_audit_logs"
  ADD CONSTRAINT "timetable_audit_logs_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "academic"."timetable_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
