-- Curriculum-driven promotion mappings and registration archival

ALTER TABLE "academic"."semester_registrations"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "promotion_run_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'semester_registrations_promotion_run_id_fkey'
  ) THEN
    ALTER TABLE "academic"."semester_registrations"
      ADD CONSTRAINT "semester_registrations_promotion_run_id_fkey"
      FOREIGN KEY ("promotion_run_id") REFERENCES "academic"."semester_promotion_runs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "semester_registrations_promotion_run_id_idx"
  ON "academic"."semester_registrations"("promotion_run_id");

CREATE TABLE IF NOT EXISTS "academic"."program_promotion_mappings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "program_version_id" UUID NOT NULL,
  "from_sequence" INTEGER NOT NULL,
  "to_sequence" INTEGER NOT NULL,
  "from_offering_id" UUID NOT NULL,
  "to_offering_id" UUID NOT NULL,
  "category" TEXT,
  "major_paper_index" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "program_promotion_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "program_promotion_mappings_program_version_id_from_offering_id_to_sequence_key"
  ON "academic"."program_promotion_mappings"("program_version_id", "from_offering_id", "to_sequence");

CREATE INDEX IF NOT EXISTS "program_promotion_mappings_tenant_id_idx"
  ON "academic"."program_promotion_mappings"("tenant_id");

CREATE INDEX IF NOT EXISTS "program_promotion_mappings_program_version_id_from_sequence_to_sequence_idx"
  ON "academic"."program_promotion_mappings"("program_version_id", "from_sequence", "to_sequence");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_promotion_mappings_program_version_id_fkey'
  ) THEN
    ALTER TABLE "academic"."program_promotion_mappings"
      ADD CONSTRAINT "program_promotion_mappings_program_version_id_fkey"
      FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_promotion_mappings_from_offering_id_fkey'
  ) THEN
    ALTER TABLE "academic"."program_promotion_mappings"
      ADD CONSTRAINT "program_promotion_mappings_from_offering_id_fkey"
      FOREIGN KEY ("from_offering_id") REFERENCES "academic"."course_offerings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_promotion_mappings_to_offering_id_fkey'
  ) THEN
    ALTER TABLE "academic"."program_promotion_mappings"
      ADD CONSTRAINT "program_promotion_mappings_to_offering_id_fkey"
      FOREIGN KEY ("to_offering_id") REFERENCES "academic"."course_offerings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
