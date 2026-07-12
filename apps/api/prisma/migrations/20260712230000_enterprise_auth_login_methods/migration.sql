-- Enterprise auth: login method flags, complexity knobs, QR challenges, per-attempt events

ALTER TABLE "platform"."tenant_security_settings"
  ADD COLUMN IF NOT EXISTS "allow_biometric_login" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allow_qr_login" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allow_rfid_login" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "require_uppercase" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "require_lowercase" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "require_number" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "require_special" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "max_concurrent_sessions" INTEGER;

CREATE TABLE IF NOT EXISTS "platform"."auth_qr_challenges" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "jti" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "redeemed_at" TIMESTAMP(3),
  "created_by_id" UUID,
  "device_hint" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_qr_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_qr_challenges_jti_key"
  ON "platform"."auth_qr_challenges"("jti");

CREATE INDEX IF NOT EXISTS "auth_qr_challenges_tenant_id_user_id_idx"
  ON "platform"."auth_qr_challenges"("tenant_id", "user_id");

CREATE INDEX IF NOT EXISTS "auth_qr_challenges_expires_at_idx"
  ON "platform"."auth_qr_challenges"("expires_at");

ALTER TABLE "platform"."auth_qr_challenges"
  DROP CONSTRAINT IF EXISTS "auth_qr_challenges_tenant_id_fkey";
ALTER TABLE "platform"."auth_qr_challenges"
  ADD CONSTRAINT "auth_qr_challenges_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."auth_qr_challenges"
  DROP CONSTRAINT IF EXISTS "auth_qr_challenges_user_id_fkey";
ALTER TABLE "platform"."auth_qr_challenges"
  ADD CONSTRAINT "auth_qr_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "platform"."auth_login_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID,
  "identifier" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "reason" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_login_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auth_login_events_tenant_id_created_at_idx"
  ON "platform"."auth_login_events"("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "auth_login_events_tenant_id_outcome_idx"
  ON "platform"."auth_login_events"("tenant_id", "outcome");

ALTER TABLE "platform"."auth_login_events"
  DROP CONSTRAINT IF EXISTS "auth_login_events_tenant_id_fkey";
ALTER TABLE "platform"."auth_login_events"
  ADD CONSTRAINT "auth_login_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."auth_login_events"
  DROP CONSTRAINT IF EXISTS "auth_login_events_user_id_fkey";
ALTER TABLE "platform"."auth_login_events"
  ADD CONSTRAINT "auth_login_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
