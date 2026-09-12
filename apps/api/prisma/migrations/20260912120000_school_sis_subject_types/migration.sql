-- St. Luke's subject types + type on subjects

CREATE TABLE IF NOT EXISTS "school"."school_subject_types" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "school_subject_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_subject_types_tenant_id_code_key"
  ON "school"."school_subject_types"("tenant_id", "code");

CREATE INDEX IF NOT EXISTS "school_subject_types_tenant_id_active_idx"
  ON "school"."school_subject_types"("tenant_id", "active");

INSERT INTO "school"."school_subject_types" ("id", "tenant_id", "code", "name", "sort_order", "active")
SELECT gen_random_uuid(), t.tenant_id, v.code, v.name, v.sort_order, true
FROM (SELECT DISTINCT "tenant_id" FROM "school"."school_subjects") t
CROSS JOIN (
  VALUES
    ('MAIN', 'Main Subject', 1),
    ('OPTIONAL', 'Optional Subject', 2)
) AS v(code, name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "school"."school_subject_types" x
  WHERE x.tenant_id = t.tenant_id AND x.code = v.code
);

ALTER TABLE "school"."school_subjects"
  ADD COLUMN IF NOT EXISTS "subject_type_id" UUID;

UPDATE "school"."school_subjects" s
SET "subject_type_id" = t.id
FROM "school"."school_subject_types" t
WHERE t.tenant_id = s.tenant_id
  AND t.code = 'MAIN'
  AND s.subject_type_id IS NULL;

CREATE INDEX IF NOT EXISTS "school_subjects_tenant_id_subject_type_id_idx"
  ON "school"."school_subjects"("tenant_id", "subject_type_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'school_subjects_subject_type_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_subjects"
      ADD CONSTRAINT "school_subjects_subject_type_id_fkey"
      FOREIGN KEY ("subject_type_id") REFERENCES "school"."school_subject_types"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
