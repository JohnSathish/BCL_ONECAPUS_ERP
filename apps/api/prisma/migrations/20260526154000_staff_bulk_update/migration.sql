CREATE TABLE "academic"."staff_bulk_update_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "update_mode" TEXT NOT NULL,
    "matching_key" TEXT NOT NULL DEFAULT 'employeeCode',
    "field_keys" JSONB NOT NULL,
    "scope_filter" JSONB,
    "values_payload" JSONB,
    "csv_payload" JSONB,
    "staff_count" INTEGER NOT NULL,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "applied_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "actor_id" UUID,
    "ip_address" TEXT,
    "applied_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_bulk_update_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."staff_bulk_update_changes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "error_message" TEXT,

    CONSTRAINT "staff_bulk_update_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_bulk_update_batches_tenant_id_created_at_idx" ON "academic"."staff_bulk_update_batches"("tenant_id", "created_at");
CREATE INDEX "staff_bulk_update_changes_batch_id_idx" ON "academic"."staff_bulk_update_changes"("batch_id");
CREATE INDEX "staff_bulk_update_changes_tenant_id_staff_profile_id_idx" ON "academic"."staff_bulk_update_changes"("tenant_id", "staff_profile_id");

ALTER TABLE "academic"."staff_bulk_update_batches"
ADD CONSTRAINT "staff_bulk_update_batches_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."staff_bulk_update_changes"
ADD CONSTRAINT "staff_bulk_update_changes_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "academic"."staff_bulk_update_batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."staff_bulk_update_changes"
ADD CONSTRAINT "staff_bulk_update_changes_staff_profile_id_fkey"
FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
