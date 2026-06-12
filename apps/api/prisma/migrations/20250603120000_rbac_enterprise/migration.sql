-- RBAC scope fields, user permission overrides, permission audit log

ALTER TABLE "platform"."user_roles"
  ADD COLUMN IF NOT EXISTS "department_id" UUID,
  ADD COLUMN IF NOT EXISTS "programme_id" UUID,
  ADD COLUMN IF NOT EXISTS "semester_no" INTEGER;

CREATE INDEX IF NOT EXISTS "user_roles_department_id_idx" ON "platform"."user_roles"("department_id");
CREATE INDEX IF NOT EXISTS "user_roles_programme_id_idx" ON "platform"."user_roles"("programme_id");

CREATE TABLE IF NOT EXISTS "platform"."user_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "effect" TEXT NOT NULL DEFAULT 'grant',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_user_id_permission_id_key"
  ON "platform"."user_permissions"("user_id", "permission_id");
CREATE INDEX IF NOT EXISTS "user_permissions_user_id_idx"
  ON "platform"."user_permissions"("user_id");

ALTER TABLE "platform"."user_permissions"
  ADD CONSTRAINT "user_permissions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."user_permissions"
  ADD CONSTRAINT "user_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "platform"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "platform"."permission_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID,
  "role_slug" TEXT,
  "permission_slug" TEXT,
  "module" TEXT,
  "action" TEXT NOT NULL,
  "outcome" TEXT NOT NULL DEFAULT 'allowed',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "permission_audit_logs_tenant_id_created_at_idx"
  ON "platform"."permission_audit_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "permission_audit_logs_tenant_id_user_id_idx"
  ON "platform"."permission_audit_logs"("tenant_id", "user_id");

ALTER TABLE "platform"."permission_audit_logs"
  ADD CONSTRAINT "permission_audit_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."permission_audit_logs"
  ADD CONSTRAINT "permission_audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
