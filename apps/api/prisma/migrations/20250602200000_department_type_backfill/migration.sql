-- Backfill administrative department classification for known operational units.
UPDATE "core"."departments"
SET "department_type" = 'ADMINISTRATIVE'
WHERE "deleted_at" IS NULL
  AND UPPER("department_code") IN (
    'ADM',
    'ACC',
    'LIB',
    'EXM',
    'IQAC',
    'ITC',
    'TRN',
    'HST',
    'MNT',
    'FRO',
    'HR',
    'STR',
    'SEC',
    'HKP'
  );

-- Link BA-ECO programme to Economics department when both exist in a tenant.
UPDATE "academic"."programs" AS p
SET "department_id" = d."id"
FROM "core"."departments" AS d
WHERE p."deleted_at" IS NULL
  AND p."code" = 'BA-ECO'
  AND (p."department_id" IS NULL OR p."department_id" <> d."id")
  AND d."deleted_at" IS NULL
  AND d."tenant_id" = p."tenant_id"
  AND UPPER(d."department_code") = 'ECO';
