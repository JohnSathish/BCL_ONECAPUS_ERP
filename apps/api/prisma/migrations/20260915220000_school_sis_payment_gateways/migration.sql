-- St. Luke's SIS: fee settings extras + payment gateway configuration

ALTER TABLE "school"."school_fee_settings"
  ADD COLUMN IF NOT EXISTS "refund_policy" TEXT,
  ADD COLUMN IF NOT EXISTS "exam_instructions" TEXT,
  ADD COLUMN IF NOT EXISTS "other_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_by_id" UUID;

CREATE TABLE IF NOT EXISTS "school"."school_payment_gateways" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'TEST',
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "credentials_encrypted" TEXT NOT NULL,
  "webhook_secret_encrypted" TEXT,
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "last_connection_test" TIMESTAMP(3),
  "connection_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "last_connection_error" TEXT,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_payment_gateways_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_payment_gateways_tenant_name_key"
  ON "school"."school_payment_gateways"("tenant_id", "name");

CREATE INDEX IF NOT EXISTS "school_payment_gateways_active_default_idx"
  ON "school"."school_payment_gateways"("tenant_id", "is_active", "is_default");

CREATE UNIQUE INDEX IF NOT EXISTS "school_payment_gateways_one_default"
  ON "school"."school_payment_gateways"("tenant_id")
  WHERE "is_default" = true AND "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "school"."school_payment_gateway_transactions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "gateway_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "fee_payment_id" UUID,
  "academic_year_id" UUID,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "order_id" TEXT NOT NULL,
  "payment_id" TEXT,
  "fee_reference" TEXT,
  "months_json" JSONB NOT NULL DEFAULT '[]',
  "collect_json" JSONB NOT NULL DEFAULT '{}',
  "raw_reference" TEXT,
  "verified_at" TIMESTAMP(3),
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_payment_gateway_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_payment_gateway_tx_order_key"
  ON "school"."school_payment_gateway_transactions"("tenant_id", "order_id");

CREATE INDEX IF NOT EXISTS "school_payment_gateway_tx_status_idx"
  ON "school"."school_payment_gateway_transactions"("tenant_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "school_payment_gateway_tx_student_idx"
  ON "school"."school_payment_gateway_transactions"("tenant_id", "student_id", "created_at");

CREATE INDEX IF NOT EXISTS "school_payment_gateway_tx_gateway_idx"
  ON "school"."school_payment_gateway_transactions"("tenant_id", "gateway_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_payment_gateway_tx_gateway_fkey') THEN
    ALTER TABLE "school"."school_payment_gateway_transactions"
      ADD CONSTRAINT "school_payment_gateway_tx_gateway_fkey"
      FOREIGN KEY ("gateway_id") REFERENCES "school"."school_payment_gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_payment_gateway_tx_student_fkey') THEN
    ALTER TABLE "school"."school_payment_gateway_transactions"
      ADD CONSTRAINT "school_payment_gateway_tx_student_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school"."school_payment_gateway_audits" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "gateway_id" UUID,
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_payment_gateway_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_payment_gateway_audits_created_idx"
  ON "school"."school_payment_gateway_audits"("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "school_payment_gateway_audits_gw_idx"
  ON "school"."school_payment_gateway_audits"("tenant_id", "gateway_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_payment_gateway_audits_gw_fkey') THEN
    ALTER TABLE "school"."school_payment_gateway_audits"
      ADD CONSTRAINT "school_payment_gateway_audits_gw_fkey"
      FOREIGN KEY ("gateway_id") REFERENCES "school"."school_payment_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
