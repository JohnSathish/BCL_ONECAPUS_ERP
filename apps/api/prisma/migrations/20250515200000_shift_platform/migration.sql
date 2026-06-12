-- Shift platform: core.shifts, migrate from academic_shifts, RBAC + student/admission bindings

CREATE TABLE "core"."shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "shift_name" TEXT NOT NULL,
    "shift_code" TEXT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "shift_type" TEXT NOT NULL DEFAULT 'REGULAR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- Migrate academic_shifts → core.shifts (attach to first campus per tenant)
INSERT INTO "core"."shifts" (
    "id", "tenant_id", "institution_id", "campus_id",
    "shift_name", "shift_code", "start_time", "end_time",
    "shift_type", "status", "sort_order", "created_at", "updated_at", "deleted_at"
)
SELECT
    s."id",
    s."tenant_id",
    c."institution_id",
    c."id",
    s."name",
    s."code",
    CASE s."code"
        WHEN 'MORNING' THEN '06:30:00'::time
        WHEN 'DAY' THEN '09:45:00'::time
        WHEN 'EVENING' THEN '14:45:00'::time
        ELSE '09:00:00'::time
    END,
    CASE s."code"
        WHEN 'MORNING' THEN '09:30:00'::time
        WHEN 'DAY' THEN '15:30:00'::time
        WHEN 'EVENING' THEN '17:45:00'::time
        ELSE '17:00:00'::time
    END,
    'REGULAR',
    'ACTIVE',
    s."sort_order",
    s."created_at",
    s."updated_at",
    s."deleted_at"
FROM "academic"."academic_shifts" s
JOIN LATERAL (
    SELECT cam."id", cam."institution_id"
    FROM "core"."campuses" cam
    WHERE cam."tenant_id" = s."tenant_id" AND cam."deleted_at" IS NULL
    ORDER BY cam."created_at"
    LIMIT 1
) c ON true;

ALTER TABLE "academic"."offering_sections" DROP CONSTRAINT IF EXISTS "offering_sections_shift_id_fkey";
ALTER TABLE "academic"."student_academic_profiles" DROP CONSTRAINT IF EXISTS "student_academic_profiles_preferred_shift_id_fkey";

ALTER TABLE "academic"."offering_sections"
    ADD CONSTRAINT "offering_sections_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "academic"."student_academic_profiles"
    ADD CONSTRAINT "student_academic_profiles_preferred_shift_id_fkey"
    FOREIGN KEY ("preferred_shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "academic"."academic_shifts";

ALTER TABLE "core"."shifts" ADD CONSTRAINT "shifts_institution_id_fkey"
    FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."shifts" ADD CONSTRAINT "shifts_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core"."shifts" ADD CONSTRAINT "shifts_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "shifts_tenant_id_idx" ON "core"."shifts"("tenant_id");
CREATE INDEX "shifts_institution_id_idx" ON "core"."shifts"("institution_id");
CREATE INDEX "shifts_campus_id_idx" ON "core"."shifts"("campus_id");

CREATE UNIQUE INDEX "shifts_campus_code_active_idx"
    ON "core"."shifts" ("campus_id", "shift_code") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "shifts_campus_name_active_idx"
    ON "core"."shifts" ("campus_id", "shift_name") WHERE "deleted_at" IS NULL;

-- User shift scope
ALTER TABLE "platform"."user_roles" ADD COLUMN IF NOT EXISTS "shift_id" UUID;
ALTER TABLE "platform"."user_roles" ADD CONSTRAINT "user_roles_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "user_roles_shift_id_idx" ON "platform"."user_roles"("shift_id");

CREATE TABLE "platform"."user_shift_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_shift_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_shift_assignments_user_id_shift_id_key"
    ON "platform"."user_shift_assignments"("user_id", "shift_id");
CREATE INDEX "user_shift_assignments_shift_id_idx" ON "platform"."user_shift_assignments"("shift_id");
ALTER TABLE "platform"."user_shift_assignments" ADD CONSTRAINT "user_shift_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform"."user_shift_assignments" ADD CONSTRAINT "user_shift_assignments_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Student primary shift
ALTER TABLE "academic"."students" ADD COLUMN IF NOT EXISTS "campus_id" UUID;
ALTER TABLE "academic"."students" ADD COLUMN IF NOT EXISTS "department_id" UUID;
ALTER TABLE "academic"."students" ADD COLUMN IF NOT EXISTS "primary_shift_id" UUID;

UPDATE "academic"."students" st
SET "primary_shift_id" = sap."preferred_shift_id"
FROM "academic"."student_academic_profiles" sap
WHERE sap."student_id" = st."id" AND st."primary_shift_id" IS NULL AND sap."preferred_shift_id" IS NOT NULL;

UPDATE "academic"."students" st
SET "campus_id" = c."id"
FROM "core"."campuses" c
WHERE st."campus_id" IS NULL AND c."tenant_id" = st."tenant_id" AND c."deleted_at" IS NULL;

ALTER TABLE "academic"."students" ADD CONSTRAINT "students_primary_shift_id_fkey"
    FOREIGN KEY ("primary_shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "students_primary_shift_id_idx" ON "academic"."students"("primary_shift_id");

-- Semester registration shift
ALTER TABLE "academic"."semester_registrations" ADD COLUMN IF NOT EXISTS "shift_id" UUID;
ALTER TABLE "academic"."semester_registrations" ADD CONSTRAINT "semester_registrations_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "semester_registrations_shift_id_idx" ON "academic"."semester_registrations"("shift_id");

UPDATE "academic"."semester_registrations" sr
SET "shift_id" = st."primary_shift_id"
FROM "academic"."students" st
WHERE sr."student_id" = st."id" AND sr."shift_id" IS NULL AND st."primary_shift_id" IS NOT NULL;

-- Admissions shift
CREATE TABLE "academic"."admission_intake_shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "intake_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "total_seats" INTEGER NOT NULL,
    "reserved_seats" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admission_intake_shifts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admission_intake_shifts_intake_id_shift_id_key"
    ON "academic"."admission_intake_shifts"("intake_id", "shift_id");
ALTER TABLE "academic"."admission_intake_shifts" ADD CONSTRAINT "admission_intake_shifts_intake_id_fkey"
    FOREIGN KEY ("intake_id") REFERENCES "academic"."admission_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."admission_intake_shifts" ADD CONSTRAINT "admission_intake_shifts_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."admission_applications" ADD COLUMN IF NOT EXISTS "preferred_shift_id" UUID;
ALTER TABLE "academic"."admission_applications" ADD CONSTRAINT "admission_applications_preferred_shift_id_fkey"
    FOREIGN KEY ("preferred_shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."seat_allocations" ADD COLUMN IF NOT EXISTS "shift_id" UUID;
ALTER TABLE "academic"."seat_allocations" ADD CONSTRAINT "seat_allocations_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "academic"."student_shift_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "from_shift_id" UUID NOT NULL,
    "to_shift_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_shift_transfers_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "academic"."student_shift_transfers" ADD CONSTRAINT "student_shift_transfers_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."student_shift_transfers" ADD CONSTRAINT "student_shift_transfers_from_shift_id_fkey"
    FOREIGN KEY ("from_shift_id") REFERENCES "core"."shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic"."student_shift_transfers" ADD CONSTRAINT "student_shift_transfers_to_shift_id_fkey"
    FOREIGN KEY ("to_shift_id") REFERENCES "core"."shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic"."student_shift_transfers" ADD CONSTRAINT "student_shift_transfers_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "academic"."faculty_shift_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "faculty_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "hours_per_week" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faculty_shift_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "faculty_shift_assignments_faculty_id_shift_id_key"
    ON "academic"."faculty_shift_assignments"("faculty_id", "shift_id");
ALTER TABLE "academic"."faculty_shift_assignments" ADD CONSTRAINT "faculty_shift_assignments_faculty_id_fkey"
    FOREIGN KEY ("faculty_id") REFERENCES "academic"."faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."faculty_shift_assignments" ADD CONSTRAINT "faculty_shift_assignments_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Module stubs
CREATE TABLE "academic"."timetable_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "offering_section_id" UUID,
    "faculty_id" UUID,
    "classroom_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "timetable_entries_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "academic"."timetable_entries" ADD CONSTRAINT "timetable_entries_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."attendance_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "offering_section_id" UUID,
    "session_date" DATE NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "academic"."attendance_sessions" ADD CONSTRAINT "attendance_sessions_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."examination_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "exam_date" DATE NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "examination_schedules_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "academic"."examination_schedules" ADD CONSTRAINT "examination_schedules_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."classroom_shift_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "slot_label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "classroom_shift_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "classroom_shift_allocations_classroom_id_shift_id_day_of_week_slot_label_key"
    ON "academic"."classroom_shift_allocations"("classroom_id", "shift_id", "day_of_week", "slot_label");
ALTER TABLE "academic"."classroom_shift_allocations" ADD CONSTRAINT "classroom_shift_allocations_classroom_id_fkey"
    FOREIGN KEY ("classroom_id") REFERENCES "academic"."classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."classroom_shift_allocations" ADD CONSTRAINT "classroom_shift_allocations_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform"."announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shift_ids" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "finance"."fee_structures" ADD COLUMN IF NOT EXISTS "shift_id" UUID;
ALTER TABLE "finance"."fee_structures" ADD CONSTRAINT "fee_structures_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
