-- Institution-level default payment method for fee collection desk.
ALTER TABLE finance.fee_finance_settings
  ADD COLUMN IF NOT EXISTS default_payment_method TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS remember_last_payment_method BOOLEAN NOT NULL DEFAULT false;
