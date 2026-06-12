-- Roll number generation: settings, prefix config, sequences, audit

CREATE TABLE "platform"."roll_number_settings" (
    "tenant_id" UUID NOT NULL,
    "sequence_length" INTEGER NOT NULL DEFAULT 3,
    "separator" TEXT NOT NULL DEFAULT '-',
    "auto_generate_on_admit" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roll_number_settings_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "platform"."roll_prefix_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "stream_id" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roll_prefix_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."roll_number_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "admission_year" INTEGER NOT NULL,
    "next_sequence" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roll_number_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."student_roll_number_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID,
    "student_id" UUID,
    "action" TEXT NOT NULL,
    "roll_number" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "manual_override" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "student_roll_number_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roll_prefix_configs_tenant_id_stream_id_key"
    ON "platform"."roll_prefix_configs"("tenant_id", "stream_id");
CREATE INDEX "roll_prefix_configs_tenant_id_idx"
    ON "platform"."roll_prefix_configs"("tenant_id");

CREATE UNIQUE INDEX "roll_number_sequences_institution_id_prefix_admission_year_key"
    ON "academic"."roll_number_sequences"("institution_id", "prefix", "admission_year");
CREATE INDEX "roll_number_sequences_tenant_id_idx"
    ON "academic"."roll_number_sequences"("tenant_id");

CREATE INDEX "student_roll_number_audit_logs_tenant_id_student_id_generated_at_idx"
    ON "academic"."student_roll_number_audit_logs"("tenant_id", "student_id", "generated_at");
CREATE INDEX "student_roll_number_audit_logs_tenant_id_institution_id_generated_at_idx"
    ON "academic"."student_roll_number_audit_logs"("tenant_id", "institution_id", "generated_at");

ALTER TABLE "platform"."roll_number_settings"
    ADD CONSTRAINT "roll_number_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."roll_prefix_configs"
    ADD CONSTRAINT "roll_prefix_configs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform"."roll_prefix_configs"
    ADD CONSTRAINT "roll_prefix_configs_stream_id_fkey"
    FOREIGN KEY ("stream_id") REFERENCES "core"."academic_streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."roll_number_sequences"
    ADD CONSTRAINT "roll_number_sequences_institution_id_fkey"
    FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_roll_number_audit_logs"
    ADD CONSTRAINT "student_roll_number_audit_logs_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."student_roll_number_audit_logs"
    ADD CONSTRAINT "student_roll_number_audit_logs_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
