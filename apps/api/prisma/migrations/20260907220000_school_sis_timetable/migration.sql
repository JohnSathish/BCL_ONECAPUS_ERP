-- St. Luke's school timetable (bells, plans, slots, rooms). Isolated in schema school.

CREATE TABLE IF NOT EXISTS "school"."school_rooms" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "school_rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_rooms_tenant_id_name_key" ON "school"."school_rooms"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "school_rooms_tenant_id_idx" ON "school"."school_rooms"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_timetable_bells" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "period_number" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_timetable_bells_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_timetable_bells_tenant_id_academic_year_id_code_key"
  ON "school"."school_timetable_bells"("tenant_id", "academic_year_id", "code");
CREATE INDEX IF NOT EXISTS "school_timetable_bells_year_sort_idx"
  ON "school"."school_timetable_bells"("tenant_id", "academic_year_id", "sort_order");

ALTER TABLE "school"."school_timetable_bells"
  ADD CONSTRAINT "school_timetable_bells_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_timetable_plans" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "days_json" JSONB NOT NULL DEFAULT '[1,2,3,4,5,6]'::jsonb,
  "effective_from" DATE,
  "effective_until" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_timetable_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_timetable_plans_year_status_idx"
  ON "school"."school_timetable_plans"("tenant_id", "academic_year_id", "status");

ALTER TABLE "school"."school_timetable_plans"
  ADD CONSTRAINT "school_timetable_plans_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_timetable_slots" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "bell_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "subject_id" UUID,
  "staff_id" UUID,
  "room_label" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_timetable_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_timetable_slots_plan_section_bell_day_key"
  ON "school"."school_timetable_slots"("plan_id", "section_id", "bell_id", "day_of_week");
CREATE INDEX IF NOT EXISTS "school_timetable_slots_staff_conflict_idx"
  ON "school"."school_timetable_slots"("tenant_id", "plan_id", "staff_id", "day_of_week", "bell_id");
CREATE INDEX IF NOT EXISTS "school_timetable_slots_room_conflict_idx"
  ON "school"."school_timetable_slots"("tenant_id", "plan_id", "room_label", "day_of_week", "bell_id");

ALTER TABLE "school"."school_timetable_slots"
  ADD CONSTRAINT "school_timetable_slots_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "school"."school_timetable_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_timetable_slots"
  ADD CONSTRAINT "school_timetable_slots_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "school"."school_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_timetable_slots"
  ADD CONSTRAINT "school_timetable_slots_bell_id_fkey"
  FOREIGN KEY ("bell_id") REFERENCES "school"."school_timetable_bells"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_timetable_slots"
  ADD CONSTRAINT "school_timetable_slots_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "school"."school_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_timetable_slots"
  ADD CONSTRAINT "school_timetable_slots_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
