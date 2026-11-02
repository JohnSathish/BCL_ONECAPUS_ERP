-- Admin email OTP challenges and 30-day trusted devices.
-- Codes are stored as hashes. Existing sessions and non-admin accounts are unchanged.

CREATE TABLE "platform"."admin_email_otp_challenges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "send_count" INTEGER NOT NULL DEFAULT 1,
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "login_meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_email_otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."admin_trusted_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "admin_trusted_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_trusted_devices_token_hash_key"
    ON "platform"."admin_trusted_devices"("token_hash");

CREATE INDEX "admin_email_otp_challenges_user_id_created_at_idx"
    ON "platform"."admin_email_otp_challenges"("user_id", "created_at");

CREATE INDEX "admin_email_otp_challenges_tenant_id_user_id_idx"
    ON "platform"."admin_email_otp_challenges"("tenant_id", "user_id");

CREATE INDEX "admin_trusted_devices_tenant_id_user_id_idx"
    ON "platform"."admin_trusted_devices"("tenant_id", "user_id");

CREATE INDEX "admin_trusted_devices_user_id_expires_at_idx"
    ON "platform"."admin_trusted_devices"("user_id", "expires_at");

ALTER TABLE "platform"."admin_email_otp_challenges"
    ADD CONSTRAINT "admin_email_otp_challenges_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."admin_email_otp_challenges"
    ADD CONSTRAINT "admin_email_otp_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."admin_trusted_devices"
    ADD CONSTRAINT "admin_trusted_devices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."admin_trusted_devices"
    ADD CONSTRAINT "admin_trusted_devices_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
