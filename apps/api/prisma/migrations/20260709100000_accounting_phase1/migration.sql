-- Phase 1: Institutional double-entry accounting (finance schema)

CREATE TABLE IF NOT EXISTS "finance"."accounting_financial_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "start_year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_financial_years_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_account_groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_account_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_ledger_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ledger_type" TEXT NOT NULL DEFAULT 'GENERAL',
    "is_cash" BOOLEAN NOT NULL DEFAULT false,
    "is_bank" BOOLEAN NOT NULL DEFAULT false,
    "bank_name" TEXT,
    "account_number" TEXT,
    "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_ledger_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_voucher_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_voucher_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_voucher_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "voucher_type_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "current_no" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_voucher_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_vouchers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "voucher_type_id" UUID NOT NULL,
    "voucher_no" TEXT NOT NULL,
    "voucher_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "narration" TEXT,
    "reference_no" TEXT,
    "cheque_no" TEXT,
    "payment_mode" TEXT,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "posted_by_id" UUID,
    "posted_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_voucher_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "entry_type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "narration" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_voucher_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_ledger_postings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_year_id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "voucher_line_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "voucher_date" DATE NOT NULL,
    "entry_type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "narration" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_ledger_postings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "finance"."accounting_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "reason" TEXT,
    "ip_address" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_financial_years_tenant_id_label_key"
  ON "finance"."accounting_financial_years"("tenant_id", "label");
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_financial_years_tenant_id_start_year_key"
  ON "finance"."accounting_financial_years"("tenant_id", "start_year");
CREATE INDEX IF NOT EXISTS "accounting_financial_years_tenant_id_is_active_idx"
  ON "finance"."accounting_financial_years"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "accounting_financial_years_tenant_id_status_idx"
  ON "finance"."accounting_financial_years"("tenant_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_account_groups_tenant_id_code_key"
  ON "finance"."accounting_account_groups"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "accounting_account_groups_tenant_id_nature_is_active_idx"
  ON "finance"."accounting_account_groups"("tenant_id", "nature", "is_active");
CREATE INDEX IF NOT EXISTS "accounting_account_groups_tenant_id_parent_id_idx"
  ON "finance"."accounting_account_groups"("tenant_id", "parent_id");

ALTER TABLE "finance"."accounting_account_groups"
  ADD CONSTRAINT "accounting_account_groups_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "finance"."accounting_account_groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_ledger_accounts_tenant_id_code_key"
  ON "finance"."accounting_ledger_accounts"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "accounting_ledger_accounts_tenant_id_group_id_is_active_idx"
  ON "finance"."accounting_ledger_accounts"("tenant_id", "group_id", "is_active");
CREATE INDEX IF NOT EXISTS "accounting_ledger_accounts_tenant_id_is_cash_is_bank_idx"
  ON "finance"."accounting_ledger_accounts"("tenant_id", "is_cash", "is_bank");

ALTER TABLE "finance"."accounting_ledger_accounts"
  ADD CONSTRAINT "accounting_ledger_accounts_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "finance"."accounting_account_groups"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_voucher_types_tenant_id_code_key"
  ON "finance"."accounting_voucher_types"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "accounting_voucher_types_tenant_id_is_active_idx"
  ON "finance"."accounting_voucher_types"("tenant_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_voucher_sequences_tenant_id_voucher_type_id_financial_year_id_key"
  ON "finance"."accounting_voucher_sequences"("tenant_id", "voucher_type_id", "financial_year_id");

ALTER TABLE "finance"."accounting_voucher_sequences"
  ADD CONSTRAINT "accounting_voucher_sequences_voucher_type_id_fkey"
  FOREIGN KEY ("voucher_type_id") REFERENCES "finance"."accounting_voucher_types"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_voucher_sequences"
  ADD CONSTRAINT "accounting_voucher_sequences_financial_year_id_fkey"
  FOREIGN KEY ("financial_year_id") REFERENCES "finance"."accounting_financial_years"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_vouchers_tenant_id_voucher_no_key"
  ON "finance"."accounting_vouchers"("tenant_id", "voucher_no");
CREATE INDEX IF NOT EXISTS "accounting_vouchers_tenant_id_financial_year_id_voucher_date_idx"
  ON "finance"."accounting_vouchers"("tenant_id", "financial_year_id", "voucher_date");
CREATE INDEX IF NOT EXISTS "accounting_vouchers_tenant_id_voucher_type_id_status_idx"
  ON "finance"."accounting_vouchers"("tenant_id", "voucher_type_id", "status");
CREATE INDEX IF NOT EXISTS "accounting_vouchers_tenant_id_status_voucher_date_idx"
  ON "finance"."accounting_vouchers"("tenant_id", "status", "voucher_date");

ALTER TABLE "finance"."accounting_vouchers"
  ADD CONSTRAINT "accounting_vouchers_financial_year_id_fkey"
  FOREIGN KEY ("financial_year_id") REFERENCES "finance"."accounting_financial_years"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_vouchers"
  ADD CONSTRAINT "accounting_vouchers_voucher_type_id_fkey"
  FOREIGN KEY ("voucher_type_id") REFERENCES "finance"."accounting_voucher_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "accounting_voucher_lines_tenant_id_voucher_id_idx"
  ON "finance"."accounting_voucher_lines"("tenant_id", "voucher_id");
CREATE INDEX IF NOT EXISTS "accounting_voucher_lines_tenant_id_ledger_account_id_idx"
  ON "finance"."accounting_voucher_lines"("tenant_id", "ledger_account_id");

ALTER TABLE "finance"."accounting_voucher_lines"
  ADD CONSTRAINT "accounting_voucher_lines_voucher_id_fkey"
  FOREIGN KEY ("voucher_id") REFERENCES "finance"."accounting_vouchers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_voucher_lines"
  ADD CONSTRAINT "accounting_voucher_lines_ledger_account_id_fkey"
  FOREIGN KEY ("ledger_account_id") REFERENCES "finance"."accounting_ledger_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "accounting_ledger_postings_tenant_id_ledger_account_id_voucher_date_idx"
  ON "finance"."accounting_ledger_postings"("tenant_id", "ledger_account_id", "voucher_date");
CREATE INDEX IF NOT EXISTS "accounting_ledger_postings_tenant_id_financial_year_id_voucher_date_idx"
  ON "finance"."accounting_ledger_postings"("tenant_id", "financial_year_id", "voucher_date");
CREATE INDEX IF NOT EXISTS "accounting_ledger_postings_tenant_id_voucher_id_idx"
  ON "finance"."accounting_ledger_postings"("tenant_id", "voucher_id");

ALTER TABLE "finance"."accounting_ledger_postings"
  ADD CONSTRAINT "accounting_ledger_postings_financial_year_id_fkey"
  FOREIGN KEY ("financial_year_id") REFERENCES "finance"."accounting_financial_years"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_ledger_postings"
  ADD CONSTRAINT "accounting_ledger_postings_voucher_id_fkey"
  FOREIGN KEY ("voucher_id") REFERENCES "finance"."accounting_vouchers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_ledger_postings"
  ADD CONSTRAINT "accounting_ledger_postings_voucher_line_id_fkey"
  FOREIGN KEY ("voucher_line_id") REFERENCES "finance"."accounting_voucher_lines"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finance"."accounting_ledger_postings"
  ADD CONSTRAINT "accounting_ledger_postings_ledger_account_id_fkey"
  FOREIGN KEY ("ledger_account_id") REFERENCES "finance"."accounting_ledger_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "accounting_audit_logs_tenant_id_entity_type_entity_id_created_at_idx"
  ON "finance"."accounting_audit_logs"("tenant_id", "entity_type", "entity_id", "created_at");
CREATE INDEX IF NOT EXISTS "accounting_audit_logs_tenant_id_action_created_at_idx"
  ON "finance"."accounting_audit_logs"("tenant_id", "action", "created_at");
