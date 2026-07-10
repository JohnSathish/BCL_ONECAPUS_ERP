-- Phase 3: Payroll auto-journal, fixed assets, bank reconciliation

ALTER TABLE "finance"."accounting_settings"
  ADD COLUMN IF NOT EXISTS "auto_post_payroll" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "salary_expense_ledger_id" UUID,
  ADD COLUMN IF NOT EXISTS "salary_payable_ledger_id" UUID,
  ADD COLUMN IF NOT EXISTS "payroll_deductions_ledger_id" UUID;

CREATE TABLE IF NOT EXISTS "finance"."accounting_payroll_component_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "component_code" TEXT NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_payroll_component_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_fixed_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "acquisition_date" DATE NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "salvage_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "useful_life_months" INTEGER NOT NULL,
    "depreciation_method" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "asset_ledger_id" UUID NOT NULL,
    "accum_depreciation_ledger_id" UUID NOT NULL,
    "expense_ledger_id" UUID NOT NULL,
    "accumulated_depreciation" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_fixed_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_depreciation_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "voucher_id" UUID,
    "posted_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_depreciation_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_bank_reconciliations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "financial_year_id" UUID,
    "statement_start_date" DATE NOT NULL,
    "statement_end_date" DATE NOT NULL,
    "statement_opening_balance" DECIMAL(14,2) NOT NULL,
    "statement_closing_balance" DECIMAL(14,2) NOT NULL,
    "book_opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "book_closing_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "reconciled_by_id" UUID,
    "reconciled_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_bank_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_bank_statement_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reconciliation_id" UUID NOT NULL,
    "line_date" DATE NOT NULL,
    "description" TEXT,
    "reference_no" TEXT,
    "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "match_status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matched_posting_id" UUID,
    "matched_voucher_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_bank_statement_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_payroll_component_mappings_tenant_id_component_code_key"
  ON "finance"."accounting_payroll_component_mappings"("tenant_id", "component_code");

CREATE INDEX IF NOT EXISTS "accounting_payroll_component_mappings_tenant_id_is_active_idx"
  ON "finance"."accounting_payroll_component_mappings"("tenant_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_fixed_assets_tenant_id_code_key"
  ON "finance"."accounting_fixed_assets"("tenant_id", "code");

CREATE INDEX IF NOT EXISTS "accounting_fixed_assets_tenant_id_status_category_idx"
  ON "finance"."accounting_fixed_assets"("tenant_id", "status", "category");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_depreciation_entries_tenant_id_asset_id_period_year_period_month_key"
  ON "finance"."accounting_depreciation_entries"("tenant_id", "asset_id", "period_year", "period_month");

CREATE INDEX IF NOT EXISTS "accounting_depreciation_entries_tenant_id_status_period_year_period_month_idx"
  ON "finance"."accounting_depreciation_entries"("tenant_id", "status", "period_year", "period_month");

CREATE INDEX IF NOT EXISTS "accounting_bank_reconciliations_tenant_id_ledger_account_id_status_idx"
  ON "finance"."accounting_bank_reconciliations"("tenant_id", "ledger_account_id", "status");

CREATE INDEX IF NOT EXISTS "accounting_bank_statement_lines_tenant_id_reconciliation_id_match_status_idx"
  ON "finance"."accounting_bank_statement_lines"("tenant_id", "reconciliation_id", "match_status");

CREATE INDEX IF NOT EXISTS "accounting_bank_statement_lines_tenant_id_line_date_idx"
  ON "finance"."accounting_bank_statement_lines"("tenant_id", "line_date");

ALTER TABLE "finance"."accounting_payroll_component_mappings"
  ADD CONSTRAINT "accounting_payroll_component_mappings_ledger_account_id_fkey"
  FOREIGN KEY ("ledger_account_id") REFERENCES "finance"."accounting_ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance"."accounting_fixed_assets"
  ADD CONSTRAINT "accounting_fixed_assets_asset_ledger_id_fkey"
  FOREIGN KEY ("asset_ledger_id") REFERENCES "finance"."accounting_ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_fixed_assets_accum_depreciation_ledger_id_fkey"
  FOREIGN KEY ("accum_depreciation_ledger_id") REFERENCES "finance"."accounting_ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_fixed_assets_expense_ledger_id_fkey"
  FOREIGN KEY ("expense_ledger_id") REFERENCES "finance"."accounting_ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance"."accounting_depreciation_entries"
  ADD CONSTRAINT "accounting_depreciation_entries_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "finance"."accounting_fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_depreciation_entries_financial_year_id_fkey"
  FOREIGN KEY ("financial_year_id") REFERENCES "finance"."accounting_financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_depreciation_entries_voucher_id_fkey"
  FOREIGN KEY ("voucher_id") REFERENCES "finance"."accounting_vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "finance"."accounting_bank_reconciliations"
  ADD CONSTRAINT "accounting_bank_reconciliations_ledger_account_id_fkey"
  FOREIGN KEY ("ledger_account_id") REFERENCES "finance"."accounting_ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_bank_reconciliations_financial_year_id_fkey"
  FOREIGN KEY ("financial_year_id") REFERENCES "finance"."accounting_financial_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "finance"."accounting_bank_statement_lines"
  ADD CONSTRAINT "accounting_bank_statement_lines_reconciliation_id_fkey"
  FOREIGN KEY ("reconciliation_id") REFERENCES "finance"."accounting_bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_bank_statement_lines_matched_posting_id_fkey"
  FOREIGN KEY ("matched_posting_id") REFERENCES "finance"."accounting_ledger_postings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_bank_statement_lines_matched_voucher_id_fkey"
  FOREIGN KEY ("matched_voucher_id") REFERENCES "finance"."accounting_vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
