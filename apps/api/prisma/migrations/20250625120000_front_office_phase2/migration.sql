-- Front Office Phase 2 — admissions link, gate pass scan codes

ALTER TABLE "core"."front_office_enquiries"
  ADD COLUMN IF NOT EXISTS "admission_application_id" UUID;

CREATE INDEX IF NOT EXISTS "front_office_enquiries_tenant_id_admission_application_id_idx"
  ON "core"."front_office_enquiries"("tenant_id", "admission_application_id");

ALTER TABLE "core"."front_office_gate_passes"
  ADD COLUMN IF NOT EXISTS "scan_code" TEXT;

UPDATE "core"."front_office_gate_passes"
SET "scan_code" = 'GP' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0')
WHERE "scan_code" IS NULL;

ALTER TABLE "core"."front_office_gate_passes" ALTER COLUMN "scan_code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "front_office_gate_passes_tenant_id_scan_code_key"
  ON "core"."front_office_gate_passes"("tenant_id", "scan_code");
