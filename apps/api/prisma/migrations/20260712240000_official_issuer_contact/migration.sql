-- Per-issuer contact for dynamic letterhead (Principal vs Vice Principal, etc.)

ALTER TABLE "core"."official_document_issuers"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT;

-- Principal (issuing notices): college principal mobile + email
UPDATE "core"."official_document_issuers"
SET
  "phone" = COALESCE(NULLIF(TRIM("phone"), ''), '+91 94021 52496'),
  "email" = COALESCE(NULLIF(TRIM("email"), ''), 'principaldbct@gmail.com')
WHERE "role_code" = 'PRINCIPAL';

-- Vice Principal: VP mobile + email
UPDATE "core"."official_document_issuers"
SET
  "phone" = COALESCE(NULLIF(TRIM("phone"), ''), '+91 96784 02086'),
  "email" = COALESCE(NULLIF(TRIM("email"), ''), 'viceprincipal@donboscocollege.ac.in')
WHERE "role_code" = 'VICE_PRINCIPAL';

-- Default letterhead fallback contact (Principal line) when issuer has no phone/email
UPDATE "core"."official_letterheads"
SET "contact_line" =
  'Mobile: +91 94021 52496 | Email: principaldbct@gmail.com | Website: www.donboscocollege.ac.in'
WHERE "is_default" = true
  AND (
    "contact_line" IS NULL
    OR "contact_line" ILIKE '%9678402086%'
    OR "contact_line" ILIKE '%viceprincipal@donboscocollege.ac.in%'
    OR "contact_line" ILIKE '%9436308357%'
  );
