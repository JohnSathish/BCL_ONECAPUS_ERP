-- Automated fee pending / due reminder emails (OFF by default until college enables).
ALTER TABLE "finance"."fee_finance_settings"
  ADD COLUMN IF NOT EXISTS "automated_fee_emails_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
