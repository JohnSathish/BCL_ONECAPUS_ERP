-- Bump shared/common pool section capacities from legacy default (40) to 200.
-- Preserves manual overrides (capacity <> 40), lab-constrained courses, and honours batches.

UPDATE "academic"."course_offerings" AS co
SET
  "capacity" = 200,
  "updated_at" = CURRENT_TIMESTAMP
FROM "academic"."courses" AS c
WHERE c."id" = co."course_id"
  AND co."deleted_at" IS NULL
  AND co."mapping_source" = 'SHARED_POOL'
  AND UPPER(co."category") IN ('AEC', 'MDC', 'SEC', 'VAC', 'VTC')
  AND co."capacity" = 40
  AND COALESCE(c."lab_required", false) = false;

UPDATE "academic"."offering_sections" AS os
SET
  "capacity" = 200,
  "updated_at" = CURRENT_TIMESTAMP
FROM "academic"."course_offerings" AS co
JOIN "academic"."courses" AS c ON c."id" = co."course_id"
WHERE os."course_offering_id" = co."id"
  AND os."deleted_at" IS NULL
  AND co."deleted_at" IS NULL
  AND co."mapping_source" = 'SHARED_POOL'
  AND UPPER(co."category") IN ('AEC', 'MDC', 'SEC', 'VAC', 'VTC')
  AND os."capacity" = 40
  AND COALESCE(c."lab_required", false) = false
  AND (
    os."student_group" IS NULL
    OR UPPER(os."student_group") NOT IN ('HONOURS', 'HONOR', 'HONORS')
  );
