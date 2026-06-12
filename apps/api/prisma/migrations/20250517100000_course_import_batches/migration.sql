CREATE TABLE IF NOT EXISTS "academic"."import_batches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "module" TEXT NOT NULL,
  "uploaded_by_user_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "strict_mode" BOOLEAN,
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "valid_rows" INTEGER NOT NULL DEFAULT 0,
  "invalid_rows" INTEGER NOT NULL DEFAULT 0,
  "successful_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_batches_tenant_id_module_idx"
  ON "academic"."import_batches"("tenant_id", "module");
CREATE INDEX IF NOT EXISTS "import_batches_tenant_id_status_idx"
  ON "academic"."import_batches"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "import_batches_uploaded_by_user_id_idx"
  ON "academic"."import_batches"("uploaded_by_user_id");

CREATE TABLE IF NOT EXISTS "academic"."import_batch_rows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batch_id" UUID NOT NULL,
  "row_number" INTEGER NOT NULL,
  "raw" JSONB NOT NULL,
  "normalized" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errors" JSONB,
  "course_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_batch_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "import_batch_rows_batch_id_row_number_key"
  ON "academic"."import_batch_rows"("batch_id", "row_number");
CREATE INDEX IF NOT EXISTS "import_batch_rows_batch_id_status_idx"
  ON "academic"."import_batch_rows"("batch_id", "status");

ALTER TABLE "academic"."import_batch_rows"
  ADD CONSTRAINT "import_batch_rows_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "academic"."import_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
