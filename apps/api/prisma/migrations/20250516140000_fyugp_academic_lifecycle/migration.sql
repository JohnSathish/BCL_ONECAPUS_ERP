-- FYUGP Academic Lifecycle & Promotion Engine

-- Academic years: institution scope
ALTER TABLE "core"."academic_years"
  ADD COLUMN IF NOT EXISTS "institution_id" UUID,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN IF NOT EXISTS "academic_year_index" INTEGER;

-- Backfill institution_id from first institution per tenant
UPDATE "core"."academic_years" ay
SET "institution_id" = (
  SELECT i.id FROM "core"."institutions" i
  WHERE i.tenant_id = ay.tenant_id AND i.deleted_at IS NULL
  ORDER BY i.created_at ASC
  LIMIT 1
)
WHERE ay."institution_id" IS NULL;

ALTER TABLE "core"."academic_years"
  ALTER COLUMN "institution_id" SET NOT NULL;

ALTER TABLE "core"."academic_years"
  ADD CONSTRAINT "academic_years_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "academic_years_institution_id_idx" ON "core"."academic_years"("institution_id");

-- Semesters: lifecycle fields
ALTER TABLE "core"."semesters"
  ADD COLUMN IF NOT EXISTS "institution_id" UUID,
  ADD COLUMN IF NOT EXISTS "semester_number" INTEGER,
  ADD COLUMN IF NOT EXISTS "semester_type" TEXT,
  ADD COLUMN IF NOT EXISTS "progression_order" INTEGER,
  ADD COLUMN IF NOT EXISTS "academic_year_index" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_terminal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "registration_open" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "attendance_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "examination_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fee_cycle_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "result_processing_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN IF NOT EXISTS "frozen_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "frozen_by" UUID;

UPDATE "core"."semesters" s
SET "institution_id" = ay."institution_id"
FROM "core"."academic_years" ay
WHERE s."academic_year_id" = ay.id AND s."institution_id" IS NULL;

UPDATE "core"."semesters" s
SET
  "semester_number" = COALESCE(s."semester_number", s."sequence"),
  "progression_order" = COALESCE(s."progression_order", s."sequence"),
  "semester_type" = COALESCE(s."semester_type", CASE WHEN s."sequence" % 2 = 1 THEN 'ODD' ELSE 'EVEN' END),
  "academic_year_index" = COALESCE(s."academic_year_index", 1)
WHERE s."deleted_at" IS NULL;

ALTER TABLE "core"."semesters"
  ALTER COLUMN "institution_id" SET NOT NULL;

ALTER TABLE "core"."semesters"
  ADD CONSTRAINT "semesters_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core"."semesters"
  ADD CONSTRAINT "semesters_frozen_by_fkey"
  FOREIGN KEY ("frozen_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "semesters_institution_id_progression_order_key"
  ON "core"."semesters"("institution_id", "progression_order")
  WHERE "deleted_at" IS NULL AND "progression_order" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "semesters_institution_id_semester_number_key"
  ON "core"."semesters"("institution_id", "semester_number")
  WHERE "deleted_at" IS NULL AND "semester_number" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "semesters_institution_id_idx" ON "core"."semesters"("institution_id");

-- Institution academic config
CREATE TABLE IF NOT EXISTS "core"."institution_academic_config" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "programme_model" TEXT NOT NULL DEFAULT 'FYUGP',
  "structure_type" TEXT NOT NULL DEFAULT 'FYUGP_3Y_6S',
  "max_active_semesters" INTEGER NOT NULL DEFAULT 6,
  "operational_years" INTEGER NOT NULL DEFAULT 3,
  "semester_pattern" TEXT NOT NULL DEFAULT 'ODD_EVEN',
  "promotion_trigger" TEXT NOT NULL DEFAULT 'ON_EVEN_ACTIVATION',
  "terminal_semester_number" INTEGER NOT NULL DEFAULT 6,
  "allow_postgraduate_continuation" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "institution_academic_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "institution_academic_config_institution_id_key"
  ON "core"."institution_academic_config"("institution_id");

ALTER TABLE "core"."institution_academic_config"
  ADD CONSTRAINT "institution_academic_config_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "institution_academic_config_tenant_id_idx"
  ON "core"."institution_academic_config"("tenant_id");

-- Campus + shift active semester
CREATE TABLE IF NOT EXISTS "core"."campus_shift_active_semesters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "shift_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activated_by" UUID,
  CONSTRAINT "campus_shift_active_semesters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "campus_shift_active_semesters_institution_id_campus_id_shift_id_key"
  ON "core"."campus_shift_active_semesters"("institution_id", "campus_id", "shift_id");

ALTER TABLE "core"."campus_shift_active_semesters"
  ADD CONSTRAINT "campus_shift_active_semesters_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "campus_shift_active_semesters_campus_id_fkey"
  FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "campus_shift_active_semesters_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "campus_shift_active_semesters_semester_id_fkey"
  FOREIGN KEY ("semester_id") REFERENCES "core"."semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "campus_shift_active_semesters_activated_by_fkey"
  FOREIGN KEY ("activated_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Student academic standing
CREATE TABLE IF NOT EXISTS "academic"."student_academic_standings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "current_semester_sequence" INTEGER NOT NULL DEFAULT 1,
  "lifecycle_state" TEXT NOT NULL DEFAULT 'ACTIVE',
  "programme_status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "alumni_eligible" BOOLEAN NOT NULL DEFAULT false,
  "promotion_locked" BOOLEAN NOT NULL DEFAULT false,
  "registration_locked" BOOLEAN NOT NULL DEFAULT false,
  "completed_at" TIMESTAMP(3),
  "last_promoted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_academic_standings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_academic_standings_student_id_key"
  ON "academic"."student_academic_standings"("student_id");

ALTER TABLE "academic"."student_academic_standings"
  ADD CONSTRAINT "student_academic_standings_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "student_academic_standings_tenant_id_idx"
  ON "academic"."student_academic_standings"("tenant_id");

-- Promotion runs
CREATE TABLE IF NOT EXISTS "academic"."semester_promotion_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "campus_id" UUID,
  "shift_id" UUID,
  "from_semester_id" UUID,
  "to_semester_sequence" INTEGER NOT NULL,
  "from_sequence" INTEGER NOT NULL,
  "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "counts" JSONB,
  "applied_at" TIMESTAMP(3),
  "applied_by" UUID,
  "rolled_back_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "semester_promotion_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "academic"."semester_promotion_runs"
  ADD CONSTRAINT "semester_promotion_runs_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "semester_promotion_runs_campus_id_fkey"
  FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "semester_promotion_runs_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "semester_promotion_runs_from_semester_id_fkey"
  FOREIGN KEY ("from_semester_id") REFERENCES "core"."semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "semester_promotion_runs_applied_by_fkey"
  FOREIGN KEY ("applied_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "semester_promotion_runs_tenant_id_idx" ON "academic"."semester_promotion_runs"("tenant_id");
CREATE INDEX IF NOT EXISTS "semester_promotion_runs_institution_id_idx" ON "academic"."semester_promotion_runs"("institution_id");

-- Promotion entries
CREATE TABLE IF NOT EXISTS "academic"."semester_promotion_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "from_sequence" INTEGER NOT NULL,
  "to_sequence" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "validation_snapshot" JSONB,
  "rolled_back_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "semester_promotion_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "semester_promotion_entries_run_id_student_id_key"
  ON "academic"."semester_promotion_entries"("run_id", "student_id");

ALTER TABLE "academic"."semester_promotion_entries"
  ADD CONSTRAINT "semester_promotion_entries_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "academic"."semester_promotion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "semester_promotion_entries_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "semester_promotion_entries_tenant_id_idx" ON "academic"."semester_promotion_entries"("tenant_id");

-- Audit logs
CREATE TABLE IF NOT EXISTS "academic"."semester_promotion_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "run_id" UUID,
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "semester_promotion_audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "academic"."semester_promotion_audit_logs"
  ADD CONSTRAINT "semester_promotion_audit_logs_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "academic"."semester_promotion_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "semester_promotion_audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "semester_promotion_audit_logs_tenant_id_idx" ON "academic"."semester_promotion_audit_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "semester_promotion_audit_logs_run_id_idx" ON "academic"."semester_promotion_audit_logs"("run_id");

-- Extend student_semester_progress
ALTER TABLE "academic"."student_semester_progress"
  ADD COLUMN IF NOT EXISTS "calendar_semester_id" UUID,
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "promotion_run_id" UUID;

ALTER TABLE "academic"."student_semester_progress"
  ADD CONSTRAINT "student_semester_progress_calendar_semester_id_fkey"
  FOREIGN KEY ("calendar_semester_id") REFERENCES "core"."semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."student_semester_progress"
  ADD CONSTRAINT "student_semester_progress_promotion_run_id_fkey"
  FOREIGN KEY ("promotion_run_id") REFERENCES "academic"."semester_promotion_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default config for existing institutions
INSERT INTO "core"."institution_academic_config" (
  "id", "tenant_id", "institution_id", "programme_model", "structure_type",
  "max_active_semesters", "operational_years", "semester_pattern", "promotion_trigger",
  "terminal_semester_number", "allow_postgraduate_continuation", "updated_at"
)
SELECT
  gen_random_uuid(),
  i.tenant_id,
  i.id,
  'FYUGP',
  'FYUGP_3Y_6S',
  6,
  3,
  'ODD_EVEN',
  'ON_EVEN_ACTIVATION',
  6,
  false,
  CURRENT_TIMESTAMP
FROM "core"."institutions" i
WHERE i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "core"."institution_academic_config" c WHERE c.institution_id = i.id
  );

-- Bootstrap standings for existing students
INSERT INTO "academic"."student_academic_standings" (
  "id", "tenant_id", "student_id", "current_semester_sequence", "updated_at"
)
SELECT gen_random_uuid(), s.tenant_id, s.id, 1, CURRENT_TIMESTAMP
FROM "academic"."students" s
WHERE s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "academic"."student_academic_standings" st WHERE st.student_id = s.id
  );
