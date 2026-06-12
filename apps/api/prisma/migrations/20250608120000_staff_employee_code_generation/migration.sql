-- Staff employee code generation: settings, type prefixes, sequences, audit

CREATE TABLE "platform"."staff_employee_code_settings" (
    "tenant_id" UUID NOT NULL,
    "org_prefix" TEXT NOT NULL DEFAULT 'DBC',
    "sequence_length" INTEGER NOT NULL DEFAULT 3,
    "separator" TEXT NOT NULL DEFAULT '-',
    "auto_generate_on_create" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_employee_code_settings_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "platform"."staff_employee_code_type_prefixes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_type" TEXT NOT NULL,
    "type_suffix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_employee_code_type_prefixes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_employee_code_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "joining_year" INTEGER NOT NULL,
    "next_sequence" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_employee_code_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_employee_code_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID,
    "staff_profile_id" UUID,
    "action" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "manual_override" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "staff_employee_code_audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "academic"."staff_profiles"
    ADD COLUMN "employee_code_auto_generated" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "employee_code_allocated_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "staff_employee_code_type_prefixes_tenant_id_staff_type_key"
    ON "platform"."staff_employee_code_type_prefixes"("tenant_id", "staff_type");
CREATE INDEX "staff_employee_code_type_prefixes_tenant_id_idx"
    ON "platform"."staff_employee_code_type_prefixes"("tenant_id");

CREATE UNIQUE INDEX "staff_employee_code_sequences_institution_id_prefix_joining_year_key"
    ON "academic"."staff_employee_code_sequences"("institution_id", "prefix", "joining_year");
CREATE INDEX "staff_employee_code_sequences_tenant_id_idx"
    ON "academic"."staff_employee_code_sequences"("tenant_id");

CREATE INDEX "staff_employee_code_audit_logs_tenant_id_staff_profile_id_generated_at_idx"
    ON "academic"."staff_employee_code_audit_logs"("tenant_id", "staff_profile_id", "generated_at");
CREATE INDEX "staff_employee_code_audit_logs_tenant_id_institution_id_generated_at_idx"
    ON "academic"."staff_employee_code_audit_logs"("tenant_id", "institution_id", "generated_at");

ALTER TABLE "platform"."staff_employee_code_settings"
    ADD CONSTRAINT "staff_employee_code_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."staff_employee_code_type_prefixes"
    ADD CONSTRAINT "staff_employee_code_type_prefixes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."staff_employee_code_sequences"
    ADD CONSTRAINT "staff_employee_code_sequences_institution_id_fkey"
    FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."staff_employee_code_audit_logs"
    ADD CONSTRAINT "staff_employee_code_audit_logs_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."staff_employee_code_audit_logs"
    ADD CONSTRAINT "staff_employee_code_audit_logs_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed defaults for existing tenants
INSERT INTO "platform"."staff_employee_code_settings" ("tenant_id", "org_prefix", "updated_at")
SELECT t.id, 'DBC', CURRENT_TIMESTAMP
FROM "platform"."tenants" t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "platform"."staff_employee_code_settings" s WHERE s.tenant_id = t.id
  );

INSERT INTO "platform"."staff_employee_code_type_prefixes" ("id", "tenant_id", "staff_type", "type_suffix", "updated_at")
SELECT gen_random_uuid(), t.id, v.staff_type, v.type_suffix, CURRENT_TIMESTAMP
FROM "platform"."tenants" t
CROSS JOIN (
    VALUES
        ('TEACHING', 'TCH'),
        ('ADMIN', 'ADM'),
        ('NON_TEACHING', 'NTS'),
        ('GUEST', 'GST'),
        ('VISITING', 'VIS'),
        ('CONTRACT', 'CTR')
) AS v(staff_type, type_suffix)
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "platform"."staff_employee_code_type_prefixes" p
    WHERE p.tenant_id = t.id AND p.staff_type = v.staff_type
  );
