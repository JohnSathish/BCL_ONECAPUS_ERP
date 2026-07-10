-- Phase 2: Fee integration, vendors, expenses, budgets

CREATE TABLE IF NOT EXISTS "finance"."accounting_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "auto_post_fees" BOOLEAN NOT NULL DEFAULT true,
    "default_cash_ledger_id" UUID,
    "default_bank_ledger_id" UUID,
    "default_income_ledger_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_fee_head_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_key" TEXT NOT NULL,
    "fee_head_id" UUID,
    "income_ledger_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_fee_head_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_payment_mode_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_mode" TEXT NOT NULL,
    "debit_ledger_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_payment_mode_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_integration_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_module" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "voucher_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_integration_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_vendors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_vendors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_expenses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "expense_no" TEXT NOT NULL,
    "vendor_id" UUID,
    "ledger_account_id" UUID NOT NULL,
    "department_id" UUID,
    "financial_year_id" UUID,
    "expense_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "bill_no" TEXT,
    "voucher_id" UUID,
    "created_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_budgets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "department_id" UUID,
    "ledger_account_id" UUID NOT NULL,
    "allocated_amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_settings_tenant_id_key"
  ON "finance"."accounting_settings"("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_fee_head_mappings_tenant_id_source_key_key"
  ON "finance"."accounting_fee_head_mappings"("tenant_id", "source_key");
CREATE INDEX IF NOT EXISTS "accounting_fee_head_mappings_tenant_id_is_active_idx"
  ON "finance"."accounting_fee_head_mappings"("tenant_id", "is_active");

ALTER TABLE "finance"."accounting_fee_head_mappings"
  ADD CONSTRAINT "accounting_fee_head_mappings_income_ledger_id_fkey"
  FOREIGN KEY ("income_ledger_id") REFERENCES "finance"."accounting_ledger_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_payment_mode_mappings_tenant_id_payment_mode_key"
  ON "finance"."accounting_payment_mode_mappings"("tenant_id", "payment_mode");
CREATE INDEX IF NOT EXISTS "accounting_payment_mode_mappings_tenant_id_is_active_idx"
  ON "finance"."accounting_payment_mode_mappings"("tenant_id", "is_active");

ALTER TABLE "finance"."accounting_payment_mode_mappings"
  ADD CONSTRAINT "accounting_payment_mode_mappings_debit_ledger_id_fkey"
  FOREIGN KEY ("debit_ledger_id") REFERENCES "finance"."accounting_ledger_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_integration_logs_tenant_id_source_module_source_type_source_id_key"
  ON "finance"."accounting_integration_logs"("tenant_id", "source_module", "source_type", "source_id");
CREATE INDEX IF NOT EXISTS "accounting_integration_logs_tenant_id_status_created_at_idx"
  ON "finance"."accounting_integration_logs"("tenant_id", "status", "created_at");

ALTER TABLE "finance"."accounting_integration_logs"
  ADD CONSTRAINT "accounting_integration_logs_voucher_id_fkey"
  FOREIGN KEY ("voucher_id") REFERENCES "finance"."accounting_vouchers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_vendors_tenant_id_code_key"
  ON "finance"."accounting_vendors"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "accounting_vendors_tenant_id_is_active_idx"
  ON "finance"."accounting_vendors"("tenant_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_expenses_tenant_id_expense_no_key"
  ON "finance"."accounting_expenses"("tenant_id", "expense_no");
CREATE INDEX IF NOT EXISTS "accounting_expenses_tenant_id_status_expense_date_idx"
  ON "finance"."accounting_expenses"("tenant_id", "status", "expense_date");
CREATE INDEX IF NOT EXISTS "accounting_expenses_tenant_id_vendor_id_idx"
  ON "finance"."accounting_expenses"("tenant_id", "vendor_id");
CREATE INDEX IF NOT EXISTS "accounting_expenses_tenant_id_department_id_idx"
  ON "finance"."accounting_expenses"("tenant_id", "department_id");

ALTER TABLE "finance"."accounting_expenses"
  ADD CONSTRAINT "accounting_expenses_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "finance"."accounting_vendors"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_expenses"
  ADD CONSTRAINT "accounting_expenses_ledger_account_id_fkey"
  FOREIGN KEY ("ledger_account_id") REFERENCES "finance"."accounting_ledger_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_expenses"
  ADD CONSTRAINT "accounting_expenses_financial_year_id_fkey"
  FOREIGN KEY ("financial_year_id") REFERENCES "finance"."accounting_financial_years"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_expenses"
  ADD CONSTRAINT "accounting_expenses_voucher_id_fkey"
  FOREIGN KEY ("voucher_id") REFERENCES "finance"."accounting_vouchers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_budgets_tenant_id_financial_year_id_department_id_ledger_account_id_key"
  ON "finance"."accounting_budgets"("tenant_id", "financial_year_id", "department_id", "ledger_account_id");
CREATE INDEX IF NOT EXISTS "accounting_budgets_tenant_id_financial_year_id_idx"
  ON "finance"."accounting_budgets"("tenant_id", "financial_year_id");

ALTER TABLE "finance"."accounting_budgets"
  ADD CONSTRAINT "accounting_budgets_financial_year_id_fkey"
  FOREIGN KEY ("financial_year_id") REFERENCES "finance"."accounting_financial_years"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_budgets"
  ADD CONSTRAINT "accounting_budgets_ledger_account_id_fkey"
  FOREIGN KEY ("ledger_account_id") REFERENCES "finance"."accounting_ledger_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
