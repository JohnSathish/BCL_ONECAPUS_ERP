-- Configurable fee collection modes per institution
ALTER TABLE finance.fee_finance_settings
  ADD COLUMN IF NOT EXISTS collection_modes JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cash_receipt_prefix VARCHAR(64) NOT NULL DEFAULT 'DBC/CASH';

-- Backfill collection_modes from legacy toggles where empty
UPDATE finance.fee_finance_settings
SET collection_modes = jsonb_build_object(
  'gateway', online_payment_enabled,
  'upi_qr', office_qr_enabled,
  'cash', cash_collection_enabled,
  'sbi_icollect', true,
  'bank_transfer', true,
  'cheque', false,
  'dd', false,
  'scholarship', true,
  'fee_waiver', true
)
WHERE collection_modes = '{}'::jsonb OR collection_modes IS NULL;
