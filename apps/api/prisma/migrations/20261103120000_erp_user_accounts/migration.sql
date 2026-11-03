-- Separate ERP portal (administrative) accounts.
-- One row per platform user that is an ERP account. Student, staff, faculty and
-- parent logins never get a row, so their login behaviour is unchanged.

CREATE TABLE "platform"."erp_user_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_code" TEXT NOT NULL,
    "employee_id" TEXT,
    "department_id" UUID,
    "designation" TEXT,
    "erp_access_enabled" BOOLEAN NOT NULL DEFAULT true,
    "locked_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "erp_user_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "erp_user_accounts_user_id_key"
    ON "platform"."erp_user_accounts"("user_id");

CREATE UNIQUE INDEX "erp_user_accounts_tenant_id_account_code_key"
    ON "platform"."erp_user_accounts"("tenant_id", "account_code");

CREATE UNIQUE INDEX "erp_user_accounts_tenant_id_employee_id_key"
    ON "platform"."erp_user_accounts"("tenant_id", "employee_id");

CREATE INDEX "erp_user_accounts_tenant_id_idx"
    ON "platform"."erp_user_accounts"("tenant_id");

CREATE INDEX "erp_user_accounts_department_id_idx"
    ON "platform"."erp_user_accounts"("department_id");

ALTER TABLE "platform"."erp_user_accounts"
    ADD CONSTRAINT "erp_user_accounts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."erp_user_accounts"
    ADD CONSTRAINT "erp_user_accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."erp_user_accounts"
    ADD CONSTRAINT "erp_user_accounts_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "core"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform"."erp_user_accounts"
    ADD CONSTRAINT "erp_user_accounts_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
