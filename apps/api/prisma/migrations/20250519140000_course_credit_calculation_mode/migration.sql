-- Flexible credit architecture: manual override for experiential NEP components

ALTER TABLE "academic"."courses"
  ADD COLUMN IF NOT EXISTS "credit_calculation_mode" TEXT NOT NULL DEFAULT 'AUTO_CALCULATED',
  ADD COLUMN IF NOT EXISTS "requires_theory_split" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "requires_practical_split" BOOLEAN NOT NULL DEFAULT false;

-- Backfill split flags from existing credit columns
UPDATE "academic"."courses"
SET
  "requires_theory_split" = ("theory_credits" > 0),
  "requires_practical_split" = ("practical_credits" > 0)
WHERE "deleted_at" IS NULL;

-- Experiential delivery types → manual credit mode
UPDATE "academic"."courses"
SET
  "credit_calculation_mode" = 'MANUAL_OVERRIDE',
  "requires_theory_split" = false,
  "requires_practical_split" = false
WHERE "deleted_at" IS NULL
  AND "delivery_type" IN (
    'INTERNSHIP',
    'APPRENTICESHIP',
    'FIELD_WORK',
    'PROJECT',
    'COMMUNITY_ENGAGEMENT',
    'DISSERTATION',
    'VIVA',
    'SEMINAR'
  );

-- Backfill total contact hours from split where zero
UPDATE "academic"."courses"
SET "total_contact_hours" = "total_theory_contact_hours" + "total_practical_contact_hours"
WHERE "deleted_at" IS NULL
  AND "total_contact_hours" = 0
  AND ("total_theory_contact_hours" + "total_practical_contact_hours") > 0;

CREATE INDEX IF NOT EXISTS "courses_credit_calculation_mode_idx"
  ON "academic"."courses" ("credit_calculation_mode");
