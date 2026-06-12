-- Program version lifecycle: status, publish/archive audit, duplicate lineage

ALTER TABLE "academic"."program_versions"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "created_by" UUID,
  ADD COLUMN IF NOT EXISTS "archived_by" UUID,
  ADD COLUMN IF NOT EXISTS "duplicated_from_version_id" UUID;

-- Backfill: highest version per program = PUBLISHED; older versions = ARCHIVED
WITH ranked AS (
  SELECT
    id,
    program_id,
    version,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY program_id ORDER BY version DESC) AS rn
  FROM "academic"."program_versions"
  WHERE "deleted_at" IS NULL
)
UPDATE "academic"."program_versions" pv
SET
  "status" = CASE WHEN r.rn = 1 THEN 'PUBLISHED' ELSE 'ARCHIVED' END,
  "published_at" = CASE WHEN r.rn = 1 THEN COALESCE(pv."published_at", pv."created_at") ELSE NULL END,
  "archived_at" = CASE WHEN r.rn > 1 THEN COALESCE(pv."archived_at", NOW()) ELSE NULL END
FROM ranked r
WHERE pv.id = r.id;

CREATE INDEX IF NOT EXISTS "program_versions_program_id_status_idx"
  ON "academic"."program_versions" ("program_id", "status")
  WHERE "deleted_at" IS NULL;
