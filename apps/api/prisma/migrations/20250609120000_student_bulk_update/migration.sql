-- Student bulk update batches and change log for preview/apply/rollback

CREATE TABLE "academic"."student_bulk_update_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "update_mode" TEXT NOT NULL,
    "field_keys" JSONB NOT NULL,
    "scope_filter" JSONB,
    "values_payload" JSONB,
    "csv_payload" JSONB,
    "student_count" INTEGER NOT NULL,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "applied_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "actor_id" UUID,
    "ip_address" TEXT,
    "applied_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_bulk_update_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."student_bulk_update_changes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "error_message" TEXT,

    CONSTRAINT "student_bulk_update_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_bulk_update_batches_tenant_id_created_at_idx" ON "academic"."student_bulk_update_batches"("tenant_id", "created_at");

CREATE INDEX "student_bulk_update_changes_batch_id_idx" ON "academic"."student_bulk_update_changes"("batch_id");

CREATE INDEX "student_bulk_update_changes_tenant_id_student_id_idx" ON "academic"."student_bulk_update_changes"("tenant_id", "student_id");

ALTER TABLE "academic"."student_bulk_update_batches" ADD CONSTRAINT "student_bulk_update_batches_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."student_bulk_update_changes" ADD CONSTRAINT "student_bulk_update_changes_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "academic"."student_bulk_update_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_bulk_update_changes" ADD CONSTRAINT "student_bulk_update_changes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
