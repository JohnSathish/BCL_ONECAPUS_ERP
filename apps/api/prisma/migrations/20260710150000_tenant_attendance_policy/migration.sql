-- Student attendance policy (First & Last vs Every Period)

CREATE TABLE IF NOT EXISTS "platform"."tenant_attendance_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "attendance_mode" TEXT NOT NULL DEFAULT 'FIRST_LAST',
  "shortage_threshold_pct" DECIMAL(5,2) NOT NULL DEFAULT 75,
  "defaulter_threshold_pct" DECIMAL(5,2) NOT NULL DEFAULT 60,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_attendance_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_attendance_policies_tenant_id_key"
  ON "platform"."tenant_attendance_policies"("tenant_id");

ALTER TABLE "platform"."tenant_attendance_policies"
  DROP CONSTRAINT IF EXISTS "tenant_attendance_policies_tenant_id_fkey";

ALTER TABLE "platform"."tenant_attendance_policies"
  ADD CONSTRAINT "tenant_attendance_policies_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
