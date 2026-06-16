-- Teaching Subject Groups (FYUGP subject-wise timetable + attendance)
CREATE TABLE IF NOT EXISTS "academic"."teaching_subject_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academic_subject_id" UUID,
    "academic_year_id" UUID,
    "semester_no" INTEGER NOT NULL,
    "shift_id" UUID,
    "fyugp_category" TEXT NOT NULL,
    "department_id" UUID,
    "primary_staff_profile_id" UUID,
    "offering_section_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "teaching_subject_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "academic"."teaching_subject_group_papers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "teaching_subject_group_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "paper_index" INTEGER,
    "offering_section_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teaching_subject_group_papers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "academic"."timetable_plan_entries"
    ADD COLUMN IF NOT EXISTS "teaching_subject_group_id" UUID;

ALTER TABLE "academic"."student_attendance_sessions"
    ADD COLUMN IF NOT EXISTS "teaching_subject_group_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "teaching_subject_groups_tenant_id_code_key"
    ON "academic"."teaching_subject_groups"("tenant_id", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "teaching_subject_group_papers_group_course_key"
    ON "academic"."teaching_subject_group_papers"("teaching_subject_group_id", "course_id");

CREATE INDEX IF NOT EXISTS "teaching_subject_groups_semester_category_idx"
    ON "academic"."teaching_subject_groups"("tenant_id", "semester_no", "fyugp_category");

CREATE INDEX IF NOT EXISTS "timetable_plan_entries_subject_group_idx"
    ON "academic"."timetable_plan_entries"("tenant_id", "teaching_subject_group_id");

CREATE INDEX IF NOT EXISTS "student_attendance_sessions_subject_group_idx"
    ON "academic"."student_attendance_sessions"("tenant_id", "teaching_subject_group_id", "semester_no");
