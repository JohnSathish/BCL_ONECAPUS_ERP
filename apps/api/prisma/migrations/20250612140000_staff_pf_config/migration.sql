-- Staff PF / CPF configuration and history

CREATE TABLE IF NOT EXISTS "finance"."staff_pf_configs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE,
  "pf_enabled" BOOLEAN NOT NULL DEFAULT true,
  "employee_pf_applicable" BOOLEAN NOT NULL DEFAULT true,
  "employer_pf_applicable" BOOLEAN NOT NULL DEFAULT true,
  "pf_scheme" TEXT NOT NULL DEFAULT 'PF_12_PERCENT',
  "employee_pf_amount" DECIMAL(12,2),
  "employer_pf_amount" DECIMAL(12,2),
  "pf_account_number" TEXT,
  "uan_number" TEXT,
  "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
  "remarks" TEXT,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "staff_profile_id")
);

CREATE TABLE IF NOT EXISTS "finance"."staff_pf_config_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "effective_from" DATE,
  "user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "staff_pf_config_history_staff_idx" ON "finance"."staff_pf_config_history" ("tenant_id", "staff_profile_id", "created_at");

-- Backfill PF exempt from pay assignment overrides
INSERT INTO "finance"."staff_pf_configs" (
  "tenant_id", "staff_profile_id", "pf_enabled", "employee_pf_applicable", "employer_pf_applicable",
  "pf_scheme", "effective_from", "remarks"
)
SELECT
  spa.tenant_id,
  spa.staff_profile_id,
  false,
  false,
  false,
  'NOT_APPLICABLE',
  spa.effective_from,
  'Migrated from PF exempt pay assignment'
FROM "finance"."staff_pay_assignments" spa
WHERE spa.status = 'ACTIVE'
  AND spa.component_overrides IS NOT NULL
  AND (spa.component_overrides->'PF_EMPLOYER'->>'disabled')::boolean = true
ON CONFLICT ("tenant_id", "staff_profile_id") DO NOTHING;
