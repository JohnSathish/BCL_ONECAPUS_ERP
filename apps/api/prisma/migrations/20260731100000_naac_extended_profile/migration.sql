-- NAAC Phase 2A — Extended Profile + ERP source keys
ALTER TABLE "naac"."naac_metrics"
  ADD COLUMN IF NOT EXISTS "erp_source_key" TEXT;

CREATE INDEX IF NOT EXISTS "naac_metrics_tenant_id_erp_source_key_idx"
  ON "naac"."naac_metrics"("tenant_id", "erp_source_key");

CREATE TABLE IF NOT EXISTS "naac"."naac_extended_profiles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year" TEXT NOT NULL,
  "sections" JSONB NOT NULL DEFAULT '{}',
  "last_pulled_at" TIMESTAMP(3),
  "pulled_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "naac_extended_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "naac_extended_profiles_tenant_id_academic_year_key"
  ON "naac"."naac_extended_profiles"("tenant_id", "academic_year");

CREATE INDEX IF NOT EXISTS "naac_extended_profiles_tenant_id_last_pulled_at_idx"
  ON "naac"."naac_extended_profiles"("tenant_id", "last_pulled_at");
