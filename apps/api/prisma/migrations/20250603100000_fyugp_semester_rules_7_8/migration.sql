-- Semester 7-8 rules, pathway variants, honours track, UI order

ALTER TABLE "academic"."semester_structure_rules"
  ADD COLUMN IF NOT EXISTS "pathway_variants" JSONB;

ALTER TABLE "academic"."semester_structure_rule_lines"
  ADD COLUMN IF NOT EXISTS "ui_order" INTEGER;

ALTER TABLE "academic"."student_academic_standings"
  ADD COLUMN IF NOT EXISTS "aggregate_percentage_through_sem6" DECIMAL(5, 2);

CREATE TABLE IF NOT EXISTS "academic"."student_academic_tracks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "track" TEXT NOT NULL,
  "effective_from_semester" INTEGER NOT NULL DEFAULT 8,
  "aggregate_percentage_at_selection" DECIMAL(5, 2),
  "eligibility_override" BOOLEAN NOT NULL DEFAULT false,
  "selected_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_academic_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_academic_tracks_student_id_effective_from_semester_key"
  ON "academic"."student_academic_tracks"("student_id", "effective_from_semester");

CREATE INDEX IF NOT EXISTS "student_academic_tracks_tenant_id_idx"
  ON "academic"."student_academic_tracks"("tenant_id");

CREATE INDEX IF NOT EXISTS "student_academic_tracks_student_id_idx"
  ON "academic"."student_academic_tracks"("student_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_academic_tracks_student_id_fkey'
  ) THEN
    ALTER TABLE "academic"."student_academic_tracks"
      ADD CONSTRAINT "student_academic_tracks_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_academic_tracks_selected_by_id_fkey'
  ) THEN
    ALTER TABLE "academic"."student_academic_tracks"
      ADD CONSTRAINT "student_academic_tracks_selected_by_id_fkey"
      FOREIGN KEY ("selected_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill Semester 7 rule for program versions that have Semester 6 but not 7
INSERT INTO "academic"."semester_structure_rules" (
  "id", "tenant_id", "program_version_id", "semester_sequence",
  "category_counts", "continuity_rules", "category_meta", "semester_credit_target", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  r6."tenant_id",
  r6."program_version_id",
  7,
  '{"MAJOR": 3, "MINOR": 2}'::jsonb,
  '{"MAJOR": "LOCK", "MINOR": "LOCK"}'::jsonb,
  '{"MAJOR": {"creditRule": 4, "mandatory": true}, "MINOR": {"creditRule": 4, "mandatory": true}}'::jsonb,
  20,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "academic"."semester_structure_rules" r6
WHERE r6."semester_sequence" = 6
  AND NOT EXISTS (
    SELECT 1 FROM "academic"."semester_structure_rules" r7
    WHERE r7."program_version_id" = r6."program_version_id"
      AND r7."semester_sequence" = 7
  );

-- Backfill Semester 8 rule with pathway variants
INSERT INTO "academic"."semester_structure_rules" (
  "id", "tenant_id", "program_version_id", "semester_sequence",
  "category_counts", "continuity_rules", "category_meta", "pathway_variants", "semester_credit_target", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  r7."tenant_id",
  r7."program_version_id",
  8,
  '{"MAJOR": 5}'::jsonb,
  '{"MAJOR": "LOCK"}'::jsonb,
  '{"MAJOR": {"creditRule": 4, "mandatory": true}}'::jsonb,
  '{
    "HONOURS": {
      "semesterSequence": 8,
      "semesterCreditTarget": 20,
      "categoryCounts": {"MAJOR": 5},
      "continuityRules": {"MAJOR": "LOCK"},
      "categoryMeta": {"MAJOR": {"creditRule": 4, "mandatory": true}}
    },
    "HONOURS_WITH_RESEARCH": {
      "semesterSequence": 8,
      "semesterCreditTarget": 20,
      "categoryCounts": {"DISSERTATION": 1, "MAJOR": 2},
      "continuityRules": {"MAJOR": "LOCK"},
      "categoryMeta": {
        "DISSERTATION": {"creditRule": 12, "mandatory": true},
        "MAJOR": {"creditRule": 4, "mandatory": true}
      }
    }
  }'::jsonb,
  20,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "academic"."semester_structure_rules" r7
WHERE r7."semester_sequence" = 7
  AND NOT EXISTS (
    SELECT 1 FROM "academic"."semester_structure_rules" r8
    WHERE r8."program_version_id" = r7."program_version_id"
      AND r8."semester_sequence" = 8
  );

-- Add pathway variants to existing Semester 8 rules missing them
UPDATE "academic"."semester_structure_rules"
SET "pathway_variants" = '{
  "HONOURS": {
    "semesterSequence": 8,
    "semesterCreditTarget": 20,
    "categoryCounts": {"MAJOR": 5},
    "continuityRules": {"MAJOR": "LOCK"},
    "categoryMeta": {"MAJOR": {"creditRule": 4, "mandatory": true}}
  },
  "HONOURS_WITH_RESEARCH": {
    "semesterSequence": 8,
    "semesterCreditTarget": 20,
    "categoryCounts": {"DISSERTATION": 1, "MAJOR": 2},
    "continuityRules": {"MAJOR": "LOCK"},
    "categoryMeta": {
      "DISSERTATION": {"creditRule": 12, "mandatory": true},
      "MAJOR": {"creditRule": 4, "mandatory": true}
    }
  }
}'::jsonb
WHERE "semester_sequence" = 8
  AND "pathway_variants" IS NULL;

-- Bump program structure templates to 8 semesters where still at 6
UPDATE "academic"."program_structure_templates"
SET "total_semesters" = 8,
    "degree_min_credits" = 160
WHERE "total_semesters" = 6;

UPDATE "academic"."fyugp_structure_templates"
SET "total_semesters" = 8
WHERE "total_semesters" = 6;
