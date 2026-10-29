ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "barcode_label_settings" JSONB;

CREATE TABLE IF NOT EXISTS "library"."library_barcode_print_jobs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "actor_id" UUID,
  "actor_label" TEXT,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARED',
  "label_count" INTEGER NOT NULL,
  "filter_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_barcode_print_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_barcode_print_jobs_tenant_id_created_at_idx"
  ON "library"."library_barcode_print_jobs" ("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "library_barcode_print_jobs_tenant_id_status_idx"
  ON "library"."library_barcode_print_jobs" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "library"."library_barcode_print_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "job_id" UUID NOT NULL,
  "copy_id" UUID NOT NULL,
  "accession_number" TEXT NOT NULL,
  "barcode" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_barcode_print_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_barcode_print_items_job_id_idx"
  ON "library"."library_barcode_print_items" ("job_id");

CREATE INDEX IF NOT EXISTS "library_barcode_print_items_tenant_id_copy_id_idx"
  ON "library"."library_barcode_print_items" ("tenant_id", "copy_id");

DO $$ BEGIN
  ALTER TABLE "library"."library_barcode_print_items"
    ADD CONSTRAINT "library_barcode_print_items_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "library"."library_barcode_print_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "library"."library_barcode_print_items"
    ADD CONSTRAINT "library_barcode_print_items_copy_id_fkey"
    FOREIGN KEY ("copy_id") REFERENCES "library"."library_book_copies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
