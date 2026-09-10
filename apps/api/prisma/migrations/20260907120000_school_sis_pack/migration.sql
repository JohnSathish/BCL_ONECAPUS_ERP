-- Isolated secondary-school SIS (St. Luke's and future school ERP tenants).
-- Does not alter college FYUP or TPS KG admission tables.

CREATE SCHEMA IF NOT EXISTS "school";

CREATE TABLE "school"."school_grades" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_grades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_grades_tenant_id_code_key" ON "school"."school_grades"("tenant_id", "code");
CREATE INDEX "school_grades_tenant_id_active_idx" ON "school"."school_grades"("tenant_id", "active");

CREATE TABLE "school"."school_sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "room_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_sections_tenant_id_academic_year_id_grade_id_name_key" ON "school"."school_sections"("tenant_id", "academic_year_id", "grade_id", "name");
CREATE INDEX "school_sections_tenant_id_academic_year_id_idx" ON "school"."school_sections"("tenant_id", "academic_year_id");

CREATE TABLE "school"."school_subjects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_subjects_tenant_id_code_key" ON "school"."school_subjects"("tenant_id", "code");
CREATE INDEX "school_subjects_tenant_id_active_idx" ON "school"."school_subjects"("tenant_id", "active");

CREATE TABLE "school"."school_grade_subjects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_grade_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_grade_subjects_tenant_year_grade_subject_key" ON "school"."school_grade_subjects"("tenant_id", "academic_year_id", "grade_id", "subject_id");

CREATE TABLE "school"."school_students" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "admission_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "gender" TEXT,
    "date_of_birth" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_students_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_students_tenant_id_admission_number_key" ON "school"."school_students"("tenant_id", "admission_number");
CREATE INDEX "school_students_tenant_id_status_idx" ON "school"."school_students"("tenant_id", "status");
CREATE INDEX "school_students_tenant_id_full_name_idx" ON "school"."school_students"("tenant_id", "full_name");

CREATE TABLE "school"."school_guardians" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_guardians_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_guardians_tenant_id_idx" ON "school"."school_guardians"("tenant_id");

CREATE TABLE "school"."school_student_guardians" (
    "student_id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,

    CONSTRAINT "school_student_guardians_pkey" PRIMARY KEY ("student_id","guardian_id")
);

CREATE TABLE "school"."school_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "roll_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_enrollments_tenant_id_student_id_academic_year_id_key" ON "school"."school_enrollments"("tenant_id", "student_id", "academic_year_id");
CREATE INDEX "school_enrollments_tenant_id_academic_year_id_section_id_idx" ON "school"."school_enrollments"("tenant_id", "academic_year_id", "section_id");

CREATE TABLE "school"."school_staff" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "staff_type" TEXT NOT NULL DEFAULT 'TEACHING',
    "designation" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "joining_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_staff_tenant_id_employee_code_key" ON "school"."school_staff"("tenant_id", "employee_code");
CREATE INDEX "school_staff_tenant_id_staff_type_status_idx" ON "school"."school_staff"("tenant_id", "staff_type", "status");

CREATE TABLE "school"."school_class_teacher_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_class_teacher_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_class_teacher_tenant_year_section_role_key" ON "school"."school_class_teacher_assignments"("tenant_id", "academic_year_id", "section_id", "role");
CREATE INDEX "school_class_teacher_assignments_tenant_id_staff_id_idx" ON "school"."school_class_teacher_assignments"("tenant_id", "staff_id");

CREATE TABLE "school"."school_subject_teacher_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "periods_per_week" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "school_subject_teacher_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_subject_teacher_tenant_year_section_subject_key" ON "school"."school_subject_teacher_assignments"("tenant_id", "academic_year_id", "section_id", "subject_id");
CREATE INDEX "school_subject_teacher_assignments_tenant_id_staff_id_idx" ON "school"."school_subject_teacher_assignments"("tenant_id", "staff_id");

ALTER TABLE "school"."school_sections" ADD CONSTRAINT "school_sections_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "school"."school_grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_grade_subjects" ADD CONSTRAINT "school_grade_subjects_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "school"."school_grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_grade_subjects" ADD CONSTRAINT "school_grade_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "school"."school_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_student_guardians" ADD CONSTRAINT "school_student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_student_guardians" ADD CONSTRAINT "school_student_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "school"."school_guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_enrollments" ADD CONSTRAINT "school_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_enrollments" ADD CONSTRAINT "school_enrollments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_class_teacher_assignments" ADD CONSTRAINT "school_class_teacher_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_class_teacher_assignments" ADD CONSTRAINT "school_class_teacher_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_subject_teacher_assignments" ADD CONSTRAINT "school_subject_teacher_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_subject_teacher_assignments" ADD CONSTRAINT "school_subject_teacher_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "school"."school_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_subject_teacher_assignments" ADD CONSTRAINT "school_subject_teacher_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
