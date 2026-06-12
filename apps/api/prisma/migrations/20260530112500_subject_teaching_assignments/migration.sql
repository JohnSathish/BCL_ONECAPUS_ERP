CREATE TABLE "academic"."subject_teaching_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "course_offering_id" UUID,
    "offering_section_id" UUID NOT NULL,
    "program_version_id" UUID,
    "academic_year_id" UUID,
    "semester_no" INTEGER NOT NULL,
    "shift_id" UUID,
    "section_code" TEXT,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY_FACULTY',
    "allocation_percent" DECIMAL(5,2),
    "weekly_hours" DECIMAL(5,2),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "can_mark_attendance" BOOLEAN NOT NULL DEFAULT true,
    "can_enter_internal_marks" BOOLEAN NOT NULL DEFAULT false,
    "can_upload_lesson_plan" BOOLEAN NOT NULL DEFAULT true,
    "can_access_subject_workspace" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATE,
    "end_date" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "subject_teaching_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subject_teaching_assignments_staff_profile_id_offering_section_id_key"
ON "academic"."subject_teaching_assignments"("staff_profile_id", "offering_section_id");

CREATE INDEX "subject_teaching_assignments_tenant_id_idx"
ON "academic"."subject_teaching_assignments"("tenant_id");

CREATE INDEX "subject_teaching_assignments_tenant_id_offering_section_id_idx"
ON "academic"."subject_teaching_assignments"("tenant_id", "offering_section_id");

CREATE INDEX "subject_teaching_assignments_tenant_id_staff_profile_id_idx"
ON "academic"."subject_teaching_assignments"("tenant_id", "staff_profile_id");

CREATE INDEX "subject_teaching_assignments_tenant_id_course_id_idx"
ON "academic"."subject_teaching_assignments"("tenant_id", "course_id");

CREATE INDEX "subject_teaching_assignments_tenant_id_academic_year_id_idx"
ON "academic"."subject_teaching_assignments"("tenant_id", "academic_year_id");

ALTER TABLE "academic"."subject_teaching_assignments"
ADD CONSTRAINT "subject_teaching_assignments_staff_profile_id_fkey"
FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."subject_teaching_assignments"
ADD CONSTRAINT "subject_teaching_assignments_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "academic"."subject_teaching_assignments"
ADD CONSTRAINT "subject_teaching_assignments_course_offering_id_fkey"
FOREIGN KEY ("course_offering_id") REFERENCES "academic"."course_offerings"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."subject_teaching_assignments"
ADD CONSTRAINT "subject_teaching_assignments_offering_section_id_fkey"
FOREIGN KEY ("offering_section_id") REFERENCES "academic"."offering_sections"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."subject_teaching_assignments"
ADD CONSTRAINT "subject_teaching_assignments_program_version_id_fkey"
FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."subject_teaching_assignments"
ADD CONSTRAINT "subject_teaching_assignments_academic_year_id_fkey"
FOREIGN KEY ("academic_year_id") REFERENCES "core"."academic_years"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."subject_teaching_assignments"
ADD CONSTRAINT "subject_teaching_assignments_shift_id_fkey"
FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."subject_teaching_assignments"
ADD CONSTRAINT "subject_teaching_assignments_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "platform"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "academic"."subject_teaching_assignments" (
    "tenant_id",
    "staff_profile_id",
    "course_id",
    "course_offering_id",
    "offering_section_id",
    "program_version_id",
    "academic_year_id",
    "semester_no",
    "shift_id",
    "section_code",
    "role",
    "allocation_percent",
    "weekly_hours",
    "is_primary",
    "can_mark_attendance",
    "can_enter_internal_marks",
    "can_upload_lesson_plan",
    "can_access_subject_workspace",
    "created_at",
    "updated_at"
)
SELECT
    ssa."tenant_id",
    ssa."staff_profile_id",
    ssa."course_id",
    os."course_offering_id",
    ssa."offering_section_id",
    ssa."program_version_id",
    ssa."academic_year_id",
    ssa."semester_no",
    ssa."shift_id",
    os."section_code",
    CASE WHEN ssa."is_primary_faculty" THEN 'PRIMARY_FACULTY' ELSE 'CO_FACULTY' END,
    CASE WHEN ssa."is_primary_faculty" THEN 100.00 ELSE NULL END,
    ssa."workload_hours",
    ssa."is_primary_faculty",
    true,
    ssa."is_primary_faculty",
    true,
    true,
    ssa."created_at",
    ssa."updated_at"
FROM "academic"."staff_subject_assignments" ssa
JOIN "academic"."offering_sections" os ON os."id" = ssa."offering_section_id"
ON CONFLICT ("staff_profile_id", "offering_section_id") DO NOTHING;
