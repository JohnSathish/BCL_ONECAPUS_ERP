-- Academic session & batch lifecycle extensions

ALTER TABLE "core"."academic_years"
  ADD COLUMN IF NOT EXISTS "is_primary_session" BOOLEAN NOT NULL DEFAULT false;

UPDATE "core"."academic_years"
SET "status" = 'UPCOMING'
WHERE "status" = 'PLANNED';

ALTER TABLE "core"."semesters"
  ADD COLUMN IF NOT EXISTS "timetable_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "core"."institution_academic_config"
  ADD COLUMN IF NOT EXISTS "current_cycle" TEXT NOT NULL DEFAULT 'ODD',
  ADD COLUMN IF NOT EXISTS "last_cycle_switch_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_cycle_switch_by" UUID,
  ADD COLUMN IF NOT EXISTS "last_cycle_rollover_group_id" UUID;

ALTER TABLE "core"."institution_academic_config"
  ADD CONSTRAINT "institution_academic_config_last_cycle_switch_by_fkey"
  FOREIGN KEY ("last_cycle_switch_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "core"."campus_shift_active_semesters_institution_id_campus_id_shift_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "campus_shift_active_semesters_institution_id_campus_id_shift_id_semester_id_key"
  ON "core"."campus_shift_active_semesters"("institution_id", "campus_id", "shift_id", "semester_id");

CREATE INDEX IF NOT EXISTS "campus_shift_active_semesters_institution_id_campus_id_shift_id_idx"
  ON "core"."campus_shift_active_semesters"("institution_id", "campus_id", "shift_id");

CREATE UNIQUE INDEX IF NOT EXISTS "semesters_institution_id_semester_number_key"
  ON "core"."semesters"("institution_id", "semester_number");

CREATE TABLE IF NOT EXISTS "academic"."admission_batches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "batch_code" TEXT NOT NULL,
  "admission_year" INTEGER NOT NULL,
  "entry_session_id" UUID NOT NULL,
  "current_semester" INTEGER NOT NULL DEFAULT 1,
  "cycle_type" TEXT NOT NULL DEFAULT 'ODD',
  "promotion_status" TEXT NOT NULL DEFAULT 'IDLE',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "admission_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admission_batches_institution_id_batch_code_key"
  ON "academic"."admission_batches"("institution_id", "batch_code");

CREATE INDEX IF NOT EXISTS "admission_batches_tenant_id_idx"
  ON "academic"."admission_batches"("tenant_id");

CREATE INDEX IF NOT EXISTS "admission_batches_institution_id_admission_year_idx"
  ON "academic"."admission_batches"("institution_id", "admission_year");

ALTER TABLE "academic"."admission_batches"
  ADD CONSTRAINT "admission_batches_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."admission_batches"
  ADD CONSTRAINT "admission_batches_entry_session_id_fkey"
  FOREIGN KEY ("entry_session_id") REFERENCES "core"."academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."batch_semester_mappings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "admission_batch_id" UUID NOT NULL,
  "semester_number" INTEGER NOT NULL,
  "calendar_semester_id" UUID,
  "cycle_type" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "frozen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "batch_semester_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "batch_semester_mappings_admission_batch_id_key"
  ON "academic"."batch_semester_mappings"("admission_batch_id");

CREATE INDEX IF NOT EXISTS "batch_semester_mappings_tenant_id_idx"
  ON "academic"."batch_semester_mappings"("tenant_id");

CREATE INDEX IF NOT EXISTS "batch_semester_mappings_institution_id_semester_number_idx"
  ON "academic"."batch_semester_mappings"("institution_id", "semester_number");

ALTER TABLE "academic"."batch_semester_mappings"
  ADD CONSTRAINT "batch_semester_mappings_admission_batch_id_fkey"
  FOREIGN KEY ("admission_batch_id") REFERENCES "academic"."admission_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."batch_semester_mappings"
  ADD CONSTRAINT "batch_semester_mappings_calendar_semester_id_fkey"
  FOREIGN KEY ("calendar_semester_id") REFERENCES "core"."semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."student_academic_profiles"
  ADD COLUMN IF NOT EXISTS "admission_batch_id" UUID;

CREATE INDEX IF NOT EXISTS "student_academic_profiles_admission_batch_id_idx"
  ON "academic"."student_academic_profiles"("admission_batch_id");

ALTER TABLE "academic"."student_academic_profiles"
  ADD CONSTRAINT "student_academic_profiles_admission_batch_id_fkey"
  FOREIGN KEY ("admission_batch_id") REFERENCES "academic"."admission_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."semester_promotion_runs"
  ADD COLUMN IF NOT EXISTS "admission_batch_id" UUID,
  ADD COLUMN IF NOT EXISTS "cycle_rollover_group_id" UUID;

CREATE INDEX IF NOT EXISTS "semester_promotion_runs_cycle_rollover_group_id_idx"
  ON "academic"."semester_promotion_runs"("cycle_rollover_group_id");

ALTER TABLE "academic"."semester_promotion_runs"
  ADD CONSTRAINT "semester_promotion_runs_admission_batch_id_fkey"
  FOREIGN KEY ("admission_batch_id") REFERENCES "academic"."admission_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
