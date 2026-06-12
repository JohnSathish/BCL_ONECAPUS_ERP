-- Resolve existing duplicates before partial unique indexes (keeps all rows; renames extras so FKs stay valid).

-- Same tenant + department + title: keep oldest row; append suffix to others.
UPDATE "academic"."courses" AS c
SET
  "title" = c."title" || ' [duplicate renamed ' || LEFT(REPLACE(c."id"::text, '-', ''), 8) || ']',
  "updated_at" = NOW()
WHERE c."id" IN (
  SELECT x."id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "tenant_id", "department_id", "title"
        ORDER BY "created_at" ASC, "id" ASC
      ) AS rn
    FROM "academic"."courses"
    WHERE "deleted_at" IS NULL AND "department_id" IS NOT NULL
  ) AS x
  WHERE x.rn > 1
);

-- Same tenant + title with no department: keep oldest; rename others.
UPDATE "academic"."courses" AS c
SET
  "title" = c."title" || ' [duplicate renamed ' || LEFT(REPLACE(c."id"::text, '-', ''), 8) || ']',
  "updated_at" = NOW()
WHERE c."id" IN (
  SELECT x."id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "tenant_id", "title"
        ORDER BY "created_at" ASC, "id" ASC
      ) AS rn
    FROM "academic"."courses"
    WHERE "deleted_at" IS NULL AND "department_id" IS NULL
  ) AS x
  WHERE x.rn > 1
);

-- Active courses only: same title may not repeat within the same department (NULL department = separate bucket).
CREATE UNIQUE INDEX IF NOT EXISTS "courses_active_tenant_dept_title_idx"
ON "academic"."courses" ("tenant_id", "department_id", "title")
WHERE "deleted_at" IS NULL AND "department_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "courses_active_tenant_title_no_dept_idx"
ON "academic"."courses" ("tenant_id", "title")
WHERE "deleted_at" IS NULL AND "department_id" IS NULL;
