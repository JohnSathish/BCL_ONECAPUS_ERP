-- Staff Accommodation & Quarters Management (academic schema)

CREATE TABLE IF NOT EXISTS "academic"."quarter_type_configs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INT NOT NULL DEFAULT 100,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "slug")
);

CREATE TABLE IF NOT EXISTS "academic"."staff_quarters" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "quarter_number" TEXT NOT NULL,
  "quarter_type" TEXT NOT NULL,
  "block" TEXT,
  "floor" TEXT,
  "number_of_rooms" INT,
  "status" TEXT NOT NULL DEFAULT 'VACANT',
  "monthly_rent" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "water_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "electricity_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maintenance_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "internet_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ,
  UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "staff_quarters_tenant_status_idx" ON "academic"."staff_quarters" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "staff_quarters_tenant_type_idx" ON "academic"."staff_quarters" ("tenant_id", "quarter_type");

CREATE TABLE IF NOT EXISTS "academic"."quarter_occupancies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "quarter_id" UUID NOT NULL REFERENCES "academic"."staff_quarters"("id") ON DELETE RESTRICT,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE RESTRICT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "allotted_at" DATE NOT NULL,
  "vacated_at" DATE,
  "monthly_rent" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "water_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "electricity_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maintenance_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "internet_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "payroll_deduction_enabled" BOOLEAN NOT NULL DEFAULT true,
  "final_meter_reading" TEXT,
  "final_charges" DECIMAL(12,2),
  "notes" TEXT,
  "vacate_notes" TEXT,
  "created_by_id" UUID,
  "vacated_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "quarter_occupancies_tenant_staff_idx" ON "academic"."quarter_occupancies" ("tenant_id", "staff_profile_id", "status");
CREATE INDEX IF NOT EXISTS "quarter_occupancies_tenant_quarter_idx" ON "academic"."quarter_occupancies" ("tenant_id", "quarter_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."quarter_monthly_charges" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "quarter_id" UUID NOT NULL REFERENCES "academic"."staff_quarters"("id") ON DELETE RESTRICT,
  "staff_profile_id" UUID NOT NULL REFERENCES "academic"."staff_profiles"("id") ON DELETE RESTRICT,
  "occupancy_id" UUID REFERENCES "academic"."quarter_occupancies"("id") ON DELETE SET NULL,
  "charge_type" TEXT NOT NULL,
  "billing_month" INT NOT NULL,
  "billing_year" INT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "remarks" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payroll_run_id" UUID,
  "payslip_id" UUID,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "quarter_monthly_charges_tenant_period_idx" ON "academic"."quarter_monthly_charges" ("tenant_id", "billing_year", "billing_month", "status");

CREATE TABLE IF NOT EXISTS "academic"."quarter_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "quarter_audit_logs_tenant_entity_idx" ON "academic"."quarter_audit_logs" ("tenant_id", "entity_type", "entity_id");

INSERT INTO platform.permissions (id, slug, resource, action, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'accommodation:read', 'accommodation', 'read', 'View staff quarters and accommodation', now(), now()),
  (gen_random_uuid(), 'accommodation:manage', 'accommodation', 'manage', 'Manage quarters, allotments, and charges', now(), now()),
  (gen_random_uuid(), 'accommodation:reports', 'accommodation', 'reports', 'Export accommodation reports', now(), now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.slug IN ('college-admin', 'super-admin', 'institution-admin')
  AND p.slug IN ('accommodation:read', 'accommodation:manage', 'accommodation:reports')
ON CONFLICT DO NOTHING;

INSERT INTO finance.pay_salary_components (id, tenant_id, code, name, component_type, category, is_statutory, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), t.id, v.code, v.name, v.component_type, v.category, false, v.sort_order, true, now(), now()
FROM platform.tenants t
CROSS JOIN (
  VALUES
    ('QUARTER_RENT', 'Quarter Rent', 'DEDUCTION', 'ACCOMMODATION', 121),
    ('ACCOM_WATER', 'Water Charge', 'DEDUCTION', 'ACCOMMODATION', 122),
    ('ACCOM_ELECTRICITY', 'Electricity Charge', 'DEDUCTION', 'ACCOMMODATION', 123),
    ('ACCOM_MAINTENANCE', 'Maintenance Charge', 'DEDUCTION', 'ACCOMMODATION', 124),
    ('ACCOM_INTERNET', 'Internet Charge', 'DEDUCTION', 'ACCOMMODATION', 125)
) AS v(code, name, component_type, category, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM finance.pay_salary_components c
  WHERE c.tenant_id = t.id AND c.code = v.code AND c.deleted_at IS NULL
);
