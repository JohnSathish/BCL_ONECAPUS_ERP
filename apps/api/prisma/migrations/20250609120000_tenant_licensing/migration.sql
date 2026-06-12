-- Tenant License Management

CREATE TABLE "platform"."tenant_licenses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "license_number" TEXT NOT NULL,
    "license_type" TEXT NOT NULL,
    "subscription_plan" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "expiry_date" DATE,
    "renewal_date" DATE,
    "grace_period_days" INTEGER NOT NULL DEFAULT 15,
    "max_students" INTEGER,
    "max_staff" INTEGER,
    "storage_limit_mb" INTEGER,
    "internal_notes" TEXT,
    "suspended_at" TIMESTAMP(3),
    "suspended_by_id" UUID,
    "suspension_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_licenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_licenses_tenant_id_key" ON "platform"."tenant_licenses"("tenant_id");
CREATE UNIQUE INDEX "tenant_licenses_license_number_key" ON "platform"."tenant_licenses"("license_number");
CREATE INDEX "tenant_licenses_expiry_date_idx" ON "platform"."tenant_licenses"("expiry_date");

ALTER TABLE "platform"."tenant_licenses" ADD CONSTRAINT "tenant_licenses_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform"."license_renewals" (
    "id" UUID NOT NULL,
    "tenant_license_id" UUID NOT NULL,
    "renewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_expiry_date" DATE,
    "new_expiry_date" DATE,
    "amount" DECIMAL(12,2),
    "invoice_number" TEXT,
    "payment_mode" TEXT,
    "notes" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_renewals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "license_renewals_tenant_license_id_renewed_at_idx"
    ON "platform"."license_renewals"("tenant_license_id", "renewed_at");

ALTER TABLE "platform"."license_renewals" ADD CONSTRAINT "license_renewals_tenant_license_id_fkey"
    FOREIGN KEY ("tenant_license_id") REFERENCES "platform"."tenant_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform"."license_notification_logs" (
    "id" UUID NOT NULL,
    "tenant_license_id" UUID NOT NULL,
    "milestone_days" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "license_notification_logs_tenant_license_id_milestone_days_channel_key"
    ON "platform"."license_notification_logs"("tenant_license_id", "milestone_days", "channel");

ALTER TABLE "platform"."license_notification_logs" ADD CONSTRAINT "license_notification_logs_tenant_license_id_fkey"
    FOREIGN KEY ("tenant_license_id") REFERENCES "platform"."tenant_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform"."license_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_license_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "license_audit_logs_tenant_license_id_created_at_idx"
    ON "platform"."license_audit_logs"("tenant_license_id", "created_at");

ALTER TABLE "platform"."license_audit_logs" ADD CONSTRAINT "license_audit_logs_tenant_license_id_fkey"
    FOREIGN KEY ("tenant_license_id") REFERENCES "platform"."tenant_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
