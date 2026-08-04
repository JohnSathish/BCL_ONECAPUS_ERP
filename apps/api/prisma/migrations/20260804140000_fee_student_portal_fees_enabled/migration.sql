-- Student-facing Fee Module activation gate (admin remains full access).
ALTER TABLE "finance"."fee_finance_settings"
  ADD COLUMN IF NOT EXISTS "student_portal_fees_enabled" BOOLEAN NOT NULL DEFAULT TRUE;
