-- FYUGP major/minor eligibility engine: subject paths + rules matrix

CREATE TABLE "academic"."academic_subjects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" UUID,
    "programme_group" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "academic_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."major_minor_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "major_subject_id" UUID NOT NULL,
    "allowed_minor_subject_id" UUID NOT NULL,
    "academic_year_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "major_minor_rules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "academic"."semester_registration_lines"
    ADD COLUMN IF NOT EXISTS "generated_by" TEXT,
    ADD COLUMN IF NOT EXISTS "credits" DECIMAL(5,2);

CREATE UNIQUE INDEX "academic_subjects_tenant_id_slug_key"
    ON "academic"."academic_subjects"("tenant_id", "slug");

CREATE INDEX "academic_subjects_tenant_id_institution_id_idx"
    ON "academic"."academic_subjects"("tenant_id", "institution_id");

CREATE INDEX "academic_subjects_department_id_idx"
    ON "academic"."academic_subjects"("department_id");

CREATE UNIQUE INDEX "major_minor_rules_tenant_major_minor_year_key"
    ON "academic"."major_minor_rules"("tenant_id", "major_subject_id", "allowed_minor_subject_id", "academic_year_id");

CREATE INDEX "major_minor_rules_tenant_id_major_subject_id_idx"
    ON "academic"."major_minor_rules"("tenant_id", "major_subject_id");

CREATE INDEX "major_minor_rules_tenant_id_allowed_minor_subject_id_idx"
    ON "academic"."major_minor_rules"("tenant_id", "allowed_minor_subject_id");

ALTER TABLE "academic"."academic_subjects"
    ADD CONSTRAINT "academic_subjects_institution_id_fkey"
    FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."academic_subjects"
    ADD CONSTRAINT "academic_subjects_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "core"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."major_minor_rules"
    ADD CONSTRAINT "major_minor_rules_major_subject_id_fkey"
    FOREIGN KEY ("major_subject_id") REFERENCES "academic"."academic_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."major_minor_rules"
    ADD CONSTRAINT "major_minor_rules_allowed_minor_subject_id_fkey"
    FOREIGN KEY ("allowed_minor_subject_id") REFERENCES "academic"."academic_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."major_minor_rules"
    ADD CONSTRAINT "major_minor_rules_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "core"."academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
