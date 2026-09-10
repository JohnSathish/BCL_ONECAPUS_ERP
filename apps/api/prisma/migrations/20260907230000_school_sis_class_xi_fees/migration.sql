-- St. Luke's Class XI fee structure (school schema only). Not college finance tables.

CREATE TABLE IF NOT EXISTS "school"."school_fee_structures" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "grade_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "source_label" TEXT,
  "notes_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_fee_structures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_structures_year_grade_code_key"
  ON "school"."school_fee_structures"("tenant_id", "academic_year_id", "grade_id", "code");
CREATE INDEX IF NOT EXISTS "school_fee_structures_year_status_idx"
  ON "school"."school_fee_structures"("tenant_id", "academic_year_id", "status");

ALTER TABLE "school"."school_fee_structures"
  ADD CONSTRAINT "school_fee_structures_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_fee_structures"
  ADD CONSTRAINT "school_fee_structures_grade_id_fkey"
  FOREIGN KEY ("grade_id") REFERENCES "school"."school_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_fee_lines" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "structure_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" INTEGER,
  "unspecified" BOOLEAN NOT NULL DEFAULT false,
  "remarks" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "school_fee_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_lines_structure_code_key"
  ON "school"."school_fee_lines"("structure_id", "code");
CREATE INDEX IF NOT EXISTS "school_fee_lines_sort_idx"
  ON "school"."school_fee_lines"("structure_id", "sort_order");

ALTER TABLE "school"."school_fee_lines"
  ADD CONSTRAINT "school_fee_lines_structure_id_fkey"
  FOREIGN KEY ("structure_id") REFERENCES "school"."school_fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "school"."school_fee_installments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "structure_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  CONSTRAINT "school_fee_installments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_installments_structure_seq_key"
  ON "school"."school_fee_installments"("structure_id", "sequence");

ALTER TABLE "school"."school_fee_installments"
  ADD CONSTRAINT "school_fee_installments_structure_id_fkey"
  FOREIGN KEY ("structure_id") REFERENCES "school"."school_fee_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
