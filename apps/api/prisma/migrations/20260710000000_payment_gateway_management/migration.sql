-- Payment Gateway Management Module (Enterprise Edition)

CREATE TABLE IF NOT EXISTS "finance"."payment_gateway_providers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_gateway_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_gateway_providers_code_key"
  ON "finance"."payment_gateway_providers"("code");

INSERT INTO "finance"."payment_gateway_providers" ("code", "name", "description", "sort_order")
VALUES
  ('RAZORPAY', 'Razorpay', 'Cards, UPI, Net Banking, Wallets', 1),
  ('BILLDESK', 'BillDesk', 'BillDesk payment gateway', 2),
  ('CASHFREE', 'Cashfree', 'Cashfree Payments', 3),
  ('PHONEPE', 'PhonePe', 'PhonePe for Business', 4),
  ('PAYU', 'PayU', 'PayU India', 5),
  ('CCAVENUE', 'CCAvenue', 'CCAvenue payment gateway', 6),
  ('EASEBUZZ', 'Easebuzz', 'Easebuzz payments', 7),
  ('STRIPE', 'Stripe', 'International cards (future)', 8),
  ('PAYPAL', 'PayPal', 'PayPal (future)', 9),
  ('CUSTOM', 'Custom Gateway API', 'Institution-specific gateway integration', 10)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "finance"."tenant_payment_gateways" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "provider_code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DISABLED',
  "mode" TEXT NOT NULL DEFAULT 'TEST',
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "merchant_id" TEXT,
  "api_key_encrypted" TEXT,
  "secret_key_encrypted" TEXT,
  "webhook_secret_encrypted" TEXT,
  "success_url" TEXT,
  "failure_url" TEXT,
  "metadata" JSONB,
  "last_health_at" TIMESTAMP(3),
  "last_health_status" TEXT,
  "configured_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_payment_gateways_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_payment_gateways_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "finance"."payment_gateway_providers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_payment_gateways_tenant_id_provider_code_key"
  ON "finance"."tenant_payment_gateways"("tenant_id", "provider_code");
CREATE INDEX IF NOT EXISTS "tenant_payment_gateways_tenant_id_is_active_idx"
  ON "finance"."tenant_payment_gateways"("tenant_id", "is_active");

CREATE TABLE IF NOT EXISTS "finance"."tenant_payment_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "allowed_modes" JSONB NOT NULL DEFAULT '{"upi":true,"creditCard":true,"debitCard":true,"netBanking":true,"wallet":false}',
  "auto_receipt" BOOLEAN NOT NULL DEFAULT true,
  "auto_email_receipt" BOOLEAN NOT NULL DEFAULT true,
  "auto_sms_notification" BOOLEAN NOT NULL DEFAULT false,
  "auto_whatsapp_notification" BOOLEAN NOT NULL DEFAULT false,
  "retry_failed_payments" BOOLEAN NOT NULL DEFAULT true,
  "payment_timeout_minutes" INTEGER NOT NULL DEFAULT 30,
  "prevent_duplicate_payments" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_payment_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_payment_settings_tenant_id_key"
  ON "finance"."tenant_payment_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "finance"."payment_webhook_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "gateway_id" UUID,
  "provider_code" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "verification_status" TEXT NOT NULL,
  "processing_status" TEXT NOT NULL DEFAULT 'PENDING',
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "error_message" TEXT,
  "replayed_at" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "payment_webhook_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_webhook_logs_gateway_id_fkey"
    FOREIGN KEY ("gateway_id") REFERENCES "finance"."tenant_payment_gateways"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "payment_webhook_logs_tenant_provider_received_idx"
  ON "finance"."payment_webhook_logs"("tenant_id", "provider_code", "received_at");
CREATE INDEX IF NOT EXISTS "payment_webhook_logs_tenant_processing_idx"
  ON "finance"."payment_webhook_logs"("tenant_id", "processing_status");

CREATE TABLE IF NOT EXISTS "finance"."payment_gateway_config_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "gateway_id" UUID,
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_gateway_config_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_gateway_config_audits_tenant_created_idx"
  ON "finance"."payment_gateway_config_audits"("tenant_id", "created_at");
