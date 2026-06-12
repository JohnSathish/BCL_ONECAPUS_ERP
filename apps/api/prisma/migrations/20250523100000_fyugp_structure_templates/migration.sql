-- Global FYUGP structure templates
CREATE TABLE "academic"."fyugp_structure_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_name" TEXT NOT NULL,
    "regulation_year" INTEGER NOT NULL,
    "programme_level" TEXT NOT NULL,
    "total_semesters" INTEGER NOT NULL DEFAULT 8,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fyugp_structure_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."fyugp_structure_template_lines" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "semester_no" INTEGER NOT NULL,
    "category_type" TEXT NOT NULL,
    "subject_count" INTEGER NOT NULL DEFAULT 0,
    "continuity_rule" TEXT,
    "credit_rule" DECIMAL(5,2),
    "optional_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fyugp_structure_template_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "academic"."program_structure_templates"
ADD COLUMN "last_applied_fyugp_template_id" UUID,
ADD COLUMN "last_applied_at" TIMESTAMP(3);

ALTER TABLE "academic"."semester_structure_rules"
ADD COLUMN "category_meta" JSONB;

CREATE UNIQUE INDEX "fyugp_structure_templates_tenant_id_template_name_key"
ON "academic"."fyugp_structure_templates"("tenant_id", "template_name");

CREATE INDEX "fyugp_structure_templates_tenant_id_active_idx"
ON "academic"."fyugp_structure_templates"("tenant_id", "active");

CREATE INDEX "fyugp_structure_templates_tenant_id_programme_level_idx"
ON "academic"."fyugp_structure_templates"("tenant_id", "programme_level");

CREATE UNIQUE INDEX "fyugp_structure_template_lines_template_id_semester_no_category_type_key"
ON "academic"."fyugp_structure_template_lines"("template_id", "semester_no", "category_type");

CREATE INDEX "fyugp_structure_template_lines_template_id_semester_no_idx"
ON "academic"."fyugp_structure_template_lines"("template_id", "semester_no");

CREATE INDEX "program_structure_templates_last_applied_fyugp_template_id_idx"
ON "academic"."program_structure_templates"("last_applied_fyugp_template_id");

ALTER TABLE "academic"."fyugp_structure_templates"
ADD CONSTRAINT "fyugp_structure_templates_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."fyugp_structure_template_lines"
ADD CONSTRAINT "fyugp_structure_template_lines_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "academic"."fyugp_structure_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."program_structure_templates"
ADD CONSTRAINT "program_structure_templates_last_applied_fyugp_template_id_fkey"
FOREIGN KEY ("last_applied_fyugp_template_id") REFERENCES "academic"."fyugp_structure_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
