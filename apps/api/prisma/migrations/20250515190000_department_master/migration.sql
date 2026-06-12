-- Department master: institution scope, type, HoD, status, uniqueness (active rows only)

ALTER TABLE "core"."departments" ADD COLUMN IF NOT EXISTS "institution_id" UUID;
ALTER TABLE "core"."departments" ADD COLUMN IF NOT EXISTS "department_type" TEXT NOT NULL DEFAULT 'ACADEMIC';
ALTER TABLE "core"."departments" ADD COLUMN IF NOT EXISTS "hod_id" UUID;
ALTER TABLE "core"."departments" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Backfill institution from campus
UPDATE "core"."departments" d
SET "institution_id" = c."institution_id"
FROM "core"."campuses" c
WHERE d."campus_id" = c."id" AND d."institution_id" IS NULL;

-- Fallback: first institution per tenant
UPDATE "core"."departments" d
SET "institution_id" = sub."id"
FROM (
  SELECT DISTINCT ON (i."tenant_id") i."tenant_id", i."id"
  FROM "core"."institutions" i
  WHERE i."deleted_at" IS NULL
  ORDER BY i."tenant_id", i."created_at"
) sub
WHERE d."tenant_id" = sub."tenant_id" AND d."institution_id" IS NULL;

ALTER TABLE "core"."departments" ALTER COLUMN "institution_id" SET NOT NULL;

-- Rename columns to match master-data naming
ALTER TABLE "core"."departments" RENAME COLUMN "name" TO "department_name";
ALTER TABLE "core"."departments" RENAME COLUMN "code" TO "department_code";

-- Normalize codes to uppercase
UPDATE "core"."departments"
SET "department_code" = UPPER(TRIM("department_code"))
WHERE "department_code" IS NOT NULL;

-- Require department code
UPDATE "core"."departments"
SET "department_code" = 'UNK'
WHERE "department_code" IS NULL OR TRIM("department_code") = '';

ALTER TABLE "core"."departments" ALTER COLUMN "department_code" SET NOT NULL;

-- Classify existing CSE as professional
UPDATE "core"."departments"
SET "department_type" = 'PROFESSIONAL'
WHERE "department_code" = 'CSE';

ALTER TABLE "core"."departments" ADD CONSTRAINT "departments_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core"."departments" ADD CONSTRAINT "departments_hod_id_fkey"
  FOREIGN KEY ("hod_id") REFERENCES "academic"."faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "departments_institution_id_idx" ON "core"."departments"("institution_id");
CREATE INDEX IF NOT EXISTS "departments_hod_id_idx" ON "core"."departments"("hod_id");

CREATE UNIQUE INDEX IF NOT EXISTS "departments_tenant_code_active_idx"
  ON "core"."departments" ("tenant_id", "department_code")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "departments_institution_name_active_idx"
  ON "core"."departments" ("institution_id", "department_name")
  WHERE "deleted_at" IS NULL;
