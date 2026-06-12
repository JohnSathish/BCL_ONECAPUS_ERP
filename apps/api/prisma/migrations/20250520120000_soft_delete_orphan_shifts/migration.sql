-- Soft-delete shifts belonging to deleted campuses (prevents duplicate labels in unscoped lists)
UPDATE "core"."shifts" s
SET "deleted_at" = CURRENT_TIMESTAMP,
    "updated_at" = CURRENT_TIMESTAMP
FROM "core"."campuses" c
WHERE s."campus_id" = c."id"
  AND c."deleted_at" IS NOT NULL
  AND s."deleted_at" IS NULL;
