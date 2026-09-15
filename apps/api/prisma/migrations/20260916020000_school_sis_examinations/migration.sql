-- School SIS configurable examinations. Isolated school schema only.

CREATE TABLE "school"."school_exam_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pass_percent" DECIMAL(6,2) NOT NULL DEFAULT 35,
    "ranking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ranking_method" TEXT NOT NULL DEFAULT 'SECTION',
    "ranking_tie" TEXT NOT NULL DEFAULT 'COMPETITION',
    "grace_enabled" BOOLEAN NOT NULL DEFAULT false,
    "grace_max" INTEGER NOT NULL DEFAULT 5,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "rounding" TEXT NOT NULL DEFAULT 'MATH',
    "absent_code" TEXT NOT NULL DEFAULT 'AB',
    "medical_code" TEXT NOT NULL DEFAULT 'ML',
    "not_appeared_code" TEXT NOT NULL DEFAULT 'NA',
    "attendance_min_percent" DECIMAL(6,2) NOT NULL DEFAULT 75,
    "attendance_affects_result" BOOLEAN NOT NULL DEFAULT false,
    "require_pass_every_subject" BOOLEAN NOT NULL DEFAULT false,
    "max_failed_subjects" INTEGER NOT NULL DEFAULT 99,
    "require_theory_pass" BOOLEAN NOT NULL DEFAULT false,
    "approval_workflow" BOOLEAN NOT NULL DEFAULT false,
    "allow_negative_marks" BOOLEAN NOT NULL DEFAULT false,
    "default_grade_system_id" UUID,
    "report_template" TEXT NOT NULL DEFAULT 'STANDARD',
    "show_rank_on_card" BOOLEAN NOT NULL DEFAULT true,
    "show_photo_on_card" BOOLEAN NOT NULL DEFAULT true,
    "remark_bands" JSONB NOT NULL DEFAULT '[]',
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_exam_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_exam_settings_tenant_id_key" ON "school"."school_exam_settings"("tenant_id");

CREATE TABLE "school"."school_exam_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "default_weight" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "grade_ids" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_exam_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_exam_types_tenant_id_code_key" ON "school"."school_exam_types"("tenant_id", "code");

CREATE TABLE "school"."school_exams" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "grade_ids" JSONB NOT NULL DEFAULT '[]',
    "settings_override" JSONB NOT NULL DEFAULT '{}',
    "marks_deadline" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_exams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_exams_tenant_id_academic_year_id_status_idx" ON "school"."school_exams"("tenant_id", "academic_year_id", "status");
ALTER TABLE "school"."school_exams" ADD CONSTRAINT "school_exams_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_exams" ADD CONSTRAINT "school_exams_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "school"."school_exam_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_exam_subjects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "max_total" DECIMAL(8,2) NOT NULL DEFAULT 100,
    "pass_total" DECIMAL(8,2) NOT NULL DEFAULT 35,
    "weightage" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "require_theory_pass" BOOLEAN NOT NULL DEFAULT false,
    "theory_max" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "theory_pass" DECIMAL(8,2) NOT NULL DEFAULT 0,
    CONSTRAINT "school_exam_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_exam_subjects_exam_id_grade_id_subject_id_key" ON "school"."school_exam_subjects"("exam_id", "grade_id", "subject_id");
ALTER TABLE "school"."school_exam_subjects" ADD CONSTRAINT "school_exam_subjects_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "school"."school_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_subjects" ADD CONSTRAINT "school_exam_subjects_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "school"."school_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_subjects" ADD CONSTRAINT "school_exam_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "school"."school_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_exam_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_subject_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "max_marks" DECIMAL(8,2) NOT NULL,
    "pass_marks" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "weightage" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "school_exam_components_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_exam_components_exam_subject_id_code_key" ON "school"."school_exam_components"("exam_subject_id", "code");
ALTER TABLE "school"."school_exam_components" ADD CONSTRAINT "school_exam_components_exam_subject_id_fkey" FOREIGN KEY ("exam_subject_id") REFERENCES "school"."school_exam_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "school"."school_exam_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "exam_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL DEFAULT 0,
    "room" TEXT,
    "max_marks" DECIMAL(8,2),
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_exam_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_exam_schedules_tenant_id_exam_id_exam_date_idx" ON "school"."school_exam_schedules"("tenant_id", "exam_id", "exam_date");
ALTER TABLE "school"."school_exam_schedules" ADD CONSTRAINT "school_exam_schedules_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "school"."school_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_schedules" ADD CONSTRAINT "school_exam_schedules_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_schedules" ADD CONSTRAINT "school_exam_schedules_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "school"."school_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_exam_invigilators" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "override" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "school_exam_invigilators_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_exam_invigilators_schedule_id_staff_id_key" ON "school"."school_exam_invigilators"("schedule_id", "staff_id");
ALTER TABLE "school"."school_exam_invigilators" ADD CONSTRAINT "school_exam_invigilators_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "school"."school_exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_invigilators" ADD CONSTRAINT "school_exam_invigilators_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_exam_marks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "marks" DECIMAL(8,2),
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "entry_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "submitted_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_exam_marks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_exam_marks_exam_id_component_id_student_id_key" ON "school"."school_exam_marks"("exam_id", "component_id", "student_id");
CREATE INDEX "school_exam_marks_tenant_id_exam_id_student_id_idx" ON "school"."school_exam_marks"("tenant_id", "exam_id", "student_id");
ALTER TABLE "school"."school_exam_marks" ADD CONSTRAINT "school_exam_marks_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "school"."school_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_marks" ADD CONSTRAINT "school_exam_marks_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "school"."school_exam_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_marks" ADD CONSTRAINT "school_exam_marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_grade_systems" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_grade_systems_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_grade_systems_tenant_id_name_key" ON "school"."school_grade_systems"("tenant_id", "name");

CREATE TABLE "school"."school_grade_bands" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "system_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "min_percent" DECIMAL(6,2) NOT NULL,
    "max_percent" DECIMAL(6,2) NOT NULL,
    "grade_point" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "school_grade_bands_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_grade_bands_system_id_idx" ON "school"."school_grade_bands"("system_id");
ALTER TABLE "school"."school_grade_bands" ADD CONSTRAINT "school_grade_bands_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "school"."school_grade_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "school"."school_exam_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "total_obtained" DECIMAL(10,2) NOT NULL,
    "total_max" DECIMAL(10,2) NOT NULL,
    "percent" DECIMAL(8,2) NOT NULL,
    "grade" TEXT,
    "grade_point" DECIMAL(4,2),
    "status" TEXT NOT NULL,
    "rank_section" INTEGER,
    "rank_class" INTEGER,
    "grace_applied" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_exam_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_exam_results_exam_id_student_id_key" ON "school"."school_exam_results"("exam_id", "student_id");
CREATE INDEX "school_exam_results_tenant_id_exam_id_status_idx" ON "school"."school_exam_results"("tenant_id", "exam_id", "status");
ALTER TABLE "school"."school_exam_results" ADD CONSTRAINT "school_exam_results_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "school"."school_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_results" ADD CONSTRAINT "school_exam_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_exam_result_subjects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "obtained" DECIMAL(8,2) NOT NULL,
    "max" DECIMAL(8,2) NOT NULL,
    "percent" DECIMAL(8,2) NOT NULL,
    "grade" TEXT,
    "status" TEXT NOT NULL,
    "grace_applied" DECIMAL(6,2) NOT NULL DEFAULT 0,
    CONSTRAINT "school_exam_result_subjects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_exam_result_subjects_result_id_idx" ON "school"."school_exam_result_subjects"("result_id");
ALTER TABLE "school"."school_exam_result_subjects" ADD CONSTRAINT "school_exam_result_subjects_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "school"."school_exam_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_exam_result_subjects" ADD CONSTRAINT "school_exam_result_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "school"."school_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_exam_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "record_id" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_exam_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_exam_audit_logs_tenant_id_created_at_idx" ON "school"."school_exam_audit_logs"("tenant_id", "created_at");
