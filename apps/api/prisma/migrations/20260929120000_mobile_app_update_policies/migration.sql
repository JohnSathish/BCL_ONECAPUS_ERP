-- Store-release update policy per platform (System → App Update Management).
CREATE TABLE IF NOT EXISTS "platform"."mobile_app_update_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "platform" TEXT NOT NULL,
  "latest_version" TEXT NOT NULL DEFAULT '1.0.0',
  "minimum_version" TEXT NOT NULL DEFAULT '1.0.0',
  "force_update" BOOLEAN NOT NULL DEFAULT false,
  "store_url" TEXT,
  "release_title" TEXT,
  "release_notes" JSONB NOT NULL DEFAULT '[]',
  "release_date" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "last_notified_at" TIMESTAMP(3),
  "last_notified_version" TEXT,
  "last_notified_count" INTEGER,
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_app_update_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_app_update_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_app_update_policies_tenant_id_platform_key"
  ON "platform"."mobile_app_update_policies"("tenant_id", "platform");
