-- License activation keys for tenant self-service renewal

CREATE TABLE "platform"."license_activation_keys" (
    "id" UUID NOT NULL,
    "activation_key" TEXT NOT NULL,
    "label" TEXT,
    "license_type" TEXT NOT NULL,
    "subscription_plan" TEXT NOT NULL,
    "term_days" INTEGER NOT NULL,
    "grace_period_days" INTEGER NOT NULL DEFAULT 15,
    "max_students" INTEGER,
    "max_staff" INTEGER,
    "storage_limit_mb" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "key_expires_at" TIMESTAMP(3),
    "redeemed_at" TIMESTAMP(3),
    "redeemed_by_tenant_id" UUID,
    "redeemed_by_user_id" UUID,
    "tenant_license_id" UUID,
    "internal_notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_activation_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "license_activation_keys_activation_key_key" ON "platform"."license_activation_keys"("activation_key");
CREATE INDEX "license_activation_keys_status_idx" ON "platform"."license_activation_keys"("status");
CREATE INDEX "license_activation_keys_redeemed_by_tenant_id_idx" ON "platform"."license_activation_keys"("redeemed_by_tenant_id");

ALTER TABLE "platform"."license_activation_keys" ADD CONSTRAINT "license_activation_keys_tenant_license_id_fkey" FOREIGN KEY ("tenant_license_id") REFERENCES "platform"."tenant_licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
