-- Administration module: extend users, add security tables

ALTER TABLE "platform"."users"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "display_name" TEXT,
  ADD COLUMN IF NOT EXISTS "account_status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "must_reset_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_username_key"
  ON "platform"."users"("tenant_id", "username")
  WHERE "username" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "users_tenant_id_account_status_idx"
  ON "platform"."users"("tenant_id", "account_status");

ALTER TABLE "platform"."audit_logs"
  ADD COLUMN IF NOT EXISTS "module" TEXT;

CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_module_idx"
  ON "platform"."audit_logs"("tenant_id", "module");

CREATE TABLE IF NOT EXISTS "platform"."username_generation_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_type" TEXT NOT NULL,
  "prefix" TEXT NOT NULL DEFAULT '',
  "suffix" TEXT NOT NULL DEFAULT '',
  "include_year" BOOLEAN NOT NULL DEFAULT true,
  "zero_padding" INTEGER NOT NULL DEFAULT 3,
  "next_sequence" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "username_generation_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "username_generation_rules_tenant_id_user_type_key"
  ON "platform"."username_generation_rules"("tenant_id", "user_type");

ALTER TABLE "platform"."username_generation_rules"
  ADD CONSTRAINT "username_generation_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "platform"."password_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_history_user_id_created_at_idx"
  ON "platform"."password_history"("user_id", "created_at");

ALTER TABLE "platform"."password_history"
  ADD CONSTRAINT "password_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "platform"."tenant_security_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "min_password_length" INTEGER NOT NULL DEFAULT 8,
  "password_expiry_days" INTEGER,
  "password_history_count" INTEGER NOT NULL DEFAULT 5,
  "force_reset_on_first_login" BOOLEAN NOT NULL DEFAULT true,
  "session_timeout_minutes" INTEGER NOT NULL DEFAULT 480,
  "mfa_enforced" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_security_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_security_settings_tenant_id_key"
  ON "platform"."tenant_security_settings"("tenant_id");

ALTER TABLE "platform"."tenant_security_settings"
  ADD CONSTRAINT "tenant_security_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "platform"."impersonation_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "admin_user_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "impersonation_sessions_tenant_id_started_at_idx"
  ON "platform"."impersonation_sessions"("tenant_id", "started_at");
CREATE INDEX IF NOT EXISTS "impersonation_sessions_admin_user_id_idx"
  ON "platform"."impersonation_sessions"("admin_user_id");
CREATE INDEX IF NOT EXISTS "impersonation_sessions_target_user_id_idx"
  ON "platform"."impersonation_sessions"("target_user_id");

ALTER TABLE "platform"."impersonation_sessions"
  ADD CONSTRAINT "impersonation_sessions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform"."impersonation_sessions"
  ADD CONSTRAINT "impersonation_sessions_admin_user_id_fkey"
  FOREIGN KEY ("admin_user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform"."impersonation_sessions"
  ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
