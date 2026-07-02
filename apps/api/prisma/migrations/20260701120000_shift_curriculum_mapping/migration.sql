-- Deactivate discontinued shifts (Evening, Arts Shift II)
UPDATE core.shifts
SET status = 'INACTIVE', updated_at = NOW()
WHERE shift_code IN ('EVENING', 'SHIFT_II')
  AND deleted_at IS NULL;

-- Shift programme availability per shift
CREATE TABLE IF NOT EXISTS academic.shift_programme_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    shift_id UUID NOT NULL REFERENCES core.shifts(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES academic.programs(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT shift_programme_configs_unique UNIQUE (tenant_id, shift_id, program_id)
);

CREATE INDEX IF NOT EXISTS shift_programme_configs_shift_idx
    ON academic.shift_programme_configs (tenant_id, shift_id);
CREATE INDEX IF NOT EXISTS shift_programme_configs_program_idx
    ON academic.shift_programme_configs (program_id);

-- Shift department availability per shift
CREATE TABLE IF NOT EXISTS academic.shift_department_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    shift_id UUID NOT NULL REFERENCES core.shifts(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES core.departments(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT shift_department_configs_unique UNIQUE (tenant_id, shift_id, department_id)
);

CREATE INDEX IF NOT EXISTS shift_department_configs_shift_idx
    ON academic.shift_department_configs (tenant_id, shift_id);

-- Optional shift scope on category pools
ALTER TABLE academic.category_pools
    ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES core.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS category_pools_shift_idx
    ON academic.category_pools (tenant_id, shift_id);

-- Optional shift scope on programme pool assignments
ALTER TABLE academic.programme_pool_assignments
    ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES core.shifts(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS academic."programme_pool_assignments_program_version_id_semester_no_pool_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS programme_pool_assignments_shift_unique
    ON academic.programme_pool_assignments (
        program_version_id,
        semester_no,
        pool_id,
        COALESCE(shift_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- Optional shift scope on major-minor rules
ALTER TABLE academic.major_minor_rules
    ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES core.shifts(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS academic."major_minor_rules_tenant_major_minor_year_key";
CREATE UNIQUE INDEX IF NOT EXISTS major_minor_rules_shift_unique
    ON academic.major_minor_rules (
        tenant_id,
        major_subject_id,
        allowed_minor_subject_id,
        COALESCE(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(shift_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- Shift curriculum policies (e.g. auto-assign VAC)
CREATE TABLE IF NOT EXISTS academic.shift_curriculum_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    shift_id UUID NOT NULL REFERENCES core.shifts(id) ON DELETE CASCADE,
    program_version_id UUID REFERENCES academic.program_versions(id) ON DELETE CASCADE,
    semester_no INT NOT NULL,
    category_type VARCHAR(32) NOT NULL,
    auto_assign BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS shift_curriculum_policies_unique
    ON academic.shift_curriculum_policies (
        tenant_id,
        shift_id,
        COALESCE(program_version_id, '00000000-0000-0000-0000-000000000000'::uuid),
        semester_no,
        category_type
    );

CREATE INDEX IF NOT EXISTS shift_curriculum_policies_shift_idx
    ON academic.shift_curriculum_policies (tenant_id, shift_id);

ALTER TABLE academic.student_academic_profiles
    ADD COLUMN IF NOT EXISTS ncc_enrolled BOOLEAN NOT NULL DEFAULT false;
