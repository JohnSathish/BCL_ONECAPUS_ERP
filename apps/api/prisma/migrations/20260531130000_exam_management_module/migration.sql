CREATE TABLE "academic"."exam_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID,
    "shift_id" UUID,
    "name" TEXT NOT NULL,
    "exam_type" TEXT NOT NULL DEFAULT 'SEMESTER_END',
    "semester_no" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."exam_paper_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "course_id" UUID,
    "offering_id" UUID,
    "paper_code" TEXT NOT NULL,
    "paper_name" TEXT NOT NULL,
    "exam_date" DATE NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "semester_no" INTEGER,
    "expected_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "exam_paper_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."exam_room_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "capacity_used" INTEGER NOT NULL DEFAULT 0,
    "seating_pattern" TEXT NOT NULL DEFAULT 'ROW_WISE',
    "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "exam_room_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."exam_seat_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "room_allocation_id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "student_id" UUID,
    "roll_number" TEXT,
    "seat_number" TEXT NOT NULL,
    "row_label" TEXT,
    "column_no" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "exam_seat_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."exam_invigilator_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "classroom_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'INVIGILATOR',
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "exam_invigilator_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."exam_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID,
    "entity" TEXT NOT NULL,
    "entity_id" UUID,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exam_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_sessions_tenant_id_status_idx" ON "academic"."exam_sessions"("tenant_id", "status");
CREATE INDEX "exam_sessions_academic_year_id_idx" ON "academic"."exam_sessions"("academic_year_id");
CREATE INDEX "exam_paper_schedules_tenant_id_session_id_idx" ON "academic"."exam_paper_schedules"("tenant_id", "session_id");
CREATE INDEX "exam_paper_schedules_exam_date_idx" ON "academic"."exam_paper_schedules"("exam_date");
CREATE INDEX "exam_paper_schedules_course_id_idx" ON "academic"."exam_paper_schedules"("course_id");
CREATE UNIQUE INDEX "exam_room_allocations_paper_id_classroom_id_key" ON "academic"."exam_room_allocations"("paper_id", "classroom_id");
CREATE INDEX "exam_room_allocations_tenant_id_session_id_idx" ON "academic"."exam_room_allocations"("tenant_id", "session_id");
CREATE INDEX "exam_room_allocations_classroom_id_idx" ON "academic"."exam_room_allocations"("classroom_id");
CREATE UNIQUE INDEX "exam_seat_allocations_paper_id_seat_number_key" ON "academic"."exam_seat_allocations"("paper_id", "seat_number");
CREATE INDEX "exam_seat_allocations_tenant_id_session_id_idx" ON "academic"."exam_seat_allocations"("tenant_id", "session_id");
CREATE INDEX "exam_seat_allocations_student_id_idx" ON "academic"."exam_seat_allocations"("student_id");
CREATE UNIQUE INDEX "exam_invigilator_assignments_paper_id_classroom_id_staff_profile_id_key" ON "academic"."exam_invigilator_assignments"("paper_id", "classroom_id", "staff_profile_id");
CREATE INDEX "exam_invigilator_assignments_tenant_id_session_id_idx" ON "academic"."exam_invigilator_assignments"("tenant_id", "session_id");
CREATE INDEX "exam_invigilator_assignments_staff_profile_id_idx" ON "academic"."exam_invigilator_assignments"("staff_profile_id");
CREATE INDEX "exam_audit_logs_tenant_id_entity_entity_id_idx" ON "academic"."exam_audit_logs"("tenant_id", "entity", "entity_id");
CREATE INDEX "exam_audit_logs_tenant_id_action_idx" ON "academic"."exam_audit_logs"("tenant_id", "action");

INSERT INTO "platform"."permissions" ("id", "slug", "resource", "action", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'exam:view', 'exam', 'view', 'View examination management data', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exam:create', 'exam', 'create', 'Create examination sessions and papers', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exam:edit', 'exam', 'edit', 'Edit examination records', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exam:delete', 'exam', 'delete', 'Archive examination records', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exam:allocate', 'exam', 'allocate', 'Allocate exam rooms and seats', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exam:invigilate', 'exam', 'invigilate', 'Assign exam invigilators', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exam:reports', 'exam', 'reports', 'View examination reports', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'exam:admin', 'exam', 'admin', 'Administer examination settings', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
