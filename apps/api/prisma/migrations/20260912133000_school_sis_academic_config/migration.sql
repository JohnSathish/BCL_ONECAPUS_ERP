-- St. Luke's academic configuration: marks, houses, clubs, optionals, ID cards

ALTER TABLE "school"."school_grades"
  ADD COLUMN IF NOT EXISTS "capacity" INTEGER;

ALTER TABLE "school"."school_sections"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "school"."school_subjects"
  ADD COLUMN IF NOT EXISTS "is_optional" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "max_marks" INTEGER,
  ADD COLUMN IF NOT EXISTS "pass_marks" INTEGER,
  ADD COLUMN IF NOT EXISTS "has_theory" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "has_practical" BOOLEAN NOT NULL DEFAULT false;

UPDATE "school"."school_subjects" s
SET "is_optional" = true
FROM "school"."school_subject_types" t
WHERE t.id = s.subject_type_id AND t.code = 'OPTIONAL';

CREATE TABLE IF NOT EXISTS "school"."school_houses" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#0ea5e9',
  "captain_name" TEXT,
  "teacher_staff_id" UUID,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "school_houses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_houses_tenant_id_name_key"
  ON "school"."school_houses"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "school_houses_tenant_id_active_idx"
  ON "school"."school_houses"("tenant_id", "active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_houses_teacher_staff_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_houses"
      ADD CONSTRAINT "school_houses_teacher_staff_id_fkey"
      FOREIGN KEY ("teacher_staff_id") REFERENCES "school"."school_staff"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school"."school_house_memberships" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "house_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_house_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_house_memberships_tenant_year_student_key"
  ON "school"."school_house_memberships"("tenant_id", "academic_year_id", "student_id");
CREATE INDEX IF NOT EXISTS "school_house_memberships_house_idx"
  ON "school"."school_house_memberships"("tenant_id", "house_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_house_memberships_year_fkey'
  ) THEN
    ALTER TABLE "school"."school_house_memberships"
      ADD CONSTRAINT "school_house_memberships_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "school"."school_house_memberships"
      ADD CONSTRAINT "school_house_memberships_house_fkey"
      FOREIGN KEY ("house_id") REFERENCES "school"."school_houses"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "school"."school_house_memberships"
      ADD CONSTRAINT "school_house_memberships_student_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school"."school_clubs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "coordinator_staff_id" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "school_clubs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_clubs_tenant_year_name_key"
  ON "school"."school_clubs"("tenant_id", "academic_year_id", "name");
CREATE INDEX IF NOT EXISTS "school_clubs_tenant_year_idx"
  ON "school"."school_clubs"("tenant_id", "academic_year_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_clubs_year_fkey'
  ) THEN
    ALTER TABLE "school"."school_clubs"
      ADD CONSTRAINT "school_clubs_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "school"."school_clubs"
      ADD CONSTRAINT "school_clubs_coordinator_fkey"
      FOREIGN KEY ("coordinator_staff_id") REFERENCES "school"."school_staff"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school"."school_club_memberships" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "club_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_club_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_club_memberships_club_student_key"
  ON "school"."school_club_memberships"("club_id", "student_id");
CREATE INDEX IF NOT EXISTS "school_club_memberships_student_idx"
  ON "school"."school_club_memberships"("tenant_id", "student_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_club_memberships_club_fkey'
  ) THEN
    ALTER TABLE "school"."school_club_memberships"
      ADD CONSTRAINT "school_club_memberships_club_fkey"
      FOREIGN KEY ("club_id") REFERENCES "school"."school_clubs"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "school"."school_club_memberships"
      ADD CONSTRAINT "school_club_memberships_student_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school"."school_club_activities" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "club_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "activity_date" DATE,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_club_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_club_activities_club_idx"
  ON "school"."school_club_activities"("tenant_id", "club_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_club_activities_club_fkey'
  ) THEN
    ALTER TABLE "school"."school_club_activities"
      ADD CONSTRAINT "school_club_activities_club_fkey"
      FOREIGN KEY ("club_id") REFERENCES "school"."school_clubs"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school"."school_student_optional_subjects" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_student_optional_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_optional_subjects_unique"
  ON "school"."school_student_optional_subjects"("tenant_id", "academic_year_id", "student_id", "subject_id");
CREATE INDEX IF NOT EXISTS "school_optional_subjects_subject_idx"
  ON "school"."school_student_optional_subjects"("tenant_id", "academic_year_id", "subject_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_optional_subjects_year_fkey'
  ) THEN
    ALTER TABLE "school"."school_student_optional_subjects"
      ADD CONSTRAINT "school_optional_subjects_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "school"."school_student_optional_subjects"
      ADD CONSTRAINT "school_optional_subjects_student_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "school"."school_student_optional_subjects"
      ADD CONSTRAINT "school_optional_subjects_subject_fkey"
      FOREIGN KEY ("subject_id") REFERENCES "school"."school_subjects"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school"."school_id_card_templates" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "layout_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "school_id_card_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_id_card_templates_tenant_name_key"
  ON "school"."school_id_card_templates"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "school_id_card_templates_status_idx"
  ON "school"."school_id_card_templates"("tenant_id", "status");
