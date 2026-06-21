-- Shift-based roll number range configuration
CREATE TABLE "platform"."roll_shift_range_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "admission_year" INTEGER NOT NULL,
    "sequence_start" INTEGER NOT NULL,
    "sequence_end" INTEGER NOT NULL,
    "next_sequence" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roll_shift_range_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roll_shift_range_configs_tenant_id_institution_id_shift_id_admission_year_key"
    ON "platform"."roll_shift_range_configs"("tenant_id", "institution_id", "shift_id", "admission_year");

CREATE INDEX "roll_shift_range_configs_tenant_id_admission_year_idx"
    ON "platform"."roll_shift_range_configs"("tenant_id", "admission_year");

ALTER TABLE "platform"."roll_shift_range_configs"
    ADD CONSTRAINT "roll_shift_range_configs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."roll_shift_range_configs"
    ADD CONSTRAINT "roll_shift_range_configs_institution_id_fkey"
    FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."roll_shift_range_configs"
    ADD CONSTRAINT "roll_shift_range_configs_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vacant / reserved roll number slots
CREATE TABLE "academic"."roll_number_vacancies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "roll_number" TEXT NOT NULL,
    "shift_id" UUID,
    "sequence_no" INTEGER,
    "admission_year" INTEGER,
    "student_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'VACANT',
    "reason" TEXT,
    "reserved_note" TEXT,
    "vacated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roll_number_vacancies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roll_number_vacancies_tenant_id_roll_number_key"
    ON "academic"."roll_number_vacancies"("tenant_id", "roll_number");

CREATE INDEX "roll_number_vacancies_tenant_id_shift_id_status_idx"
    ON "academic"."roll_number_vacancies"("tenant_id", "shift_id", "status");

CREATE INDEX "roll_number_vacancies_tenant_id_institution_id_admission_year_idx"
    ON "academic"."roll_number_vacancies"("tenant_id", "institution_id", "admission_year");

ALTER TABLE "academic"."roll_number_vacancies"
    ADD CONSTRAINT "roll_number_vacancies_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."roll_number_vacancies"
    ADD CONSTRAINT "roll_number_vacancies_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "core"."shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."roll_number_vacancies"
    ADD CONSTRAINT "roll_number_vacancies_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Shift transfer roll number tracking
ALTER TABLE "academic"."student_shift_transfers"
    ADD COLUMN "old_roll_number" TEXT,
    ADD COLUMN "new_roll_number" TEXT;
