-- Casual leave is 15 days in a calendar year.
-- Existing applications and used days are left as recorded.
UPDATE "academic"."staff_leave_types"
SET "yearly_limit" = 15,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" IN ('CL', 'CASUAL')
  AND ("yearly_limit" IS NULL OR "yearly_limit" < 15);

UPDATE "academic"."staff_leave_balances" AS balance
SET "allocated_days" = 15,
    "updated_at" = CURRENT_TIMESTAMP
FROM "academic"."staff_leave_types" AS leave_type
WHERE balance."leave_type_id" = leave_type."id"
  AND leave_type."code" IN ('CL', 'CASUAL')
  AND balance."year" = EXTRACT(YEAR FROM CURRENT_DATE)::int
  AND balance."allocated_days" < 15;

INSERT INTO "academic"."staff_leave_types" (
  "id",
  "tenant_id",
  "code",
  "name",
  "yearly_limit",
  "gender_restriction",
  "attachment_required",
  "approval_flow",
  "active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  tenants."tenant_id",
  'MAT',
  'Maternity Leave',
  NULL,
  'FEMALE',
  true,
  '["PRINCIPAL"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "tenant_id" FROM "academic"."staff_leave_types"
) AS tenants
WHERE NOT EXISTS (
  SELECT 1
  FROM "academic"."staff_leave_types" AS existing
  WHERE existing."tenant_id" = tenants."tenant_id"
    AND existing."code" = 'MAT'
);

INSERT INTO "academic"."staff_leave_types" (
  "id",
  "tenant_id",
  "code",
  "name",
  "yearly_limit",
  "gender_restriction",
  "attachment_required",
  "approval_flow",
  "active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  tenants."tenant_id",
  'PAT',
  'Paternity Leave',
  NULL,
  'MALE',
  true,
  '["PRINCIPAL"]'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "tenant_id" FROM "academic"."staff_leave_types"
) AS tenants
WHERE NOT EXISTS (
  SELECT 1
  FROM "academic"."staff_leave_types" AS existing
  WHERE existing."tenant_id" = tenants."tenant_id"
    AND existing."code" = 'PAT'
);
