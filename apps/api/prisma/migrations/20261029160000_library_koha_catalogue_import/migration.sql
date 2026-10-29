-- Koha catalogue import: extend existing library books/copies and add staging tables.
-- Does not touch any Koha database.

ALTER TABLE "library"."library_books"
  ADD COLUMN IF NOT EXISTS "subtitle" TEXT,
  ADD COLUMN IF NOT EXISTS "publication_year" TEXT,
  ADD COLUMN IF NOT EXISTS "publication_place" TEXT,
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "subject" TEXT,
  ADD COLUMN IF NOT EXISTS "series" TEXT,
  ADD COLUMN IF NOT EXISTS "classification_number" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "source_system" TEXT,
  ADD COLUMN IF NOT EXISTS "source_bibliographic_id" TEXT,
  ADD COLUMN IF NOT EXISTS "additional_authors" TEXT,
  ADD COLUMN IF NOT EXISTS "issn" TEXT,
  ADD COLUMN IF NOT EXISTS "cover_image_url" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "library_books_tenant_id_source_system_source_bibliographic_id_key"
  ON "library"."library_books"("tenant_id", "source_system", "source_bibliographic_id");

ALTER TABLE "library"."library_book_copies"
  ADD COLUMN IF NOT EXISTS "accession_number" TEXT,
  ADD COLUMN IF NOT EXISTS "source_system" TEXT,
  ADD COLUMN IF NOT EXISTS "source_item_id" TEXT,
  ADD COLUMN IF NOT EXISTS "collection_code" TEXT,
  ADD COLUMN IF NOT EXISTS "shelving_location" TEXT,
  ADD COLUMN IF NOT EXISTS "call_number" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisition_date" DATE,
  ADD COLUMN IF NOT EXISTS "acquisition_price" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "home_branch_code" TEXT,
  ADD COLUMN IF NOT EXISTS "item_type_code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "library_book_copies_tenant_id_source_system_source_item_id_key"
  ON "library"."library_book_copies"("tenant_id", "source_system", "source_item_id");

CREATE UNIQUE INDEX IF NOT EXISTS "library_book_copies_tenant_id_accession_number_key"
  ON "library"."library_book_copies"("tenant_id", "accession_number");

CREATE INDEX IF NOT EXISTS "library_book_copies_tenant_id_collection_code_idx"
  ON "library"."library_book_copies"("tenant_id", "collection_code");

CREATE TABLE IF NOT EXISTS "library"."library_book_departments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "book_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_book_departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_book_departments_book_id_department_id_key"
  ON "library"."library_book_departments"("book_id", "department_id");
CREATE INDEX IF NOT EXISTS "library_book_departments_tenant_id_department_id_idx"
  ON "library"."library_book_departments"("tenant_id", "department_id");

DO $$ BEGIN
  ALTER TABLE "library"."library_book_departments"
    ADD CONSTRAINT "library_book_departments_book_id_fkey"
    FOREIGN KEY ("book_id") REFERENCES "library"."library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "library"."library_collection_department_mappings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "source_collection_code" TEXT NOT NULL,
  "source_collection_description" TEXT,
  "department_id" UUID,
  "mapping_status" TEXT NOT NULL DEFAULT 'UNMAPPED',
  "mapping_method" TEXT NOT NULL DEFAULT 'NONE',
  "verified_by_id" UUID,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_collection_department_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_collection_department_mappings_tenant_id_source_collection_code_key"
  ON "library"."library_collection_department_mappings"("tenant_id", "source_collection_code");
CREATE INDEX IF NOT EXISTS "library_collection_department_mappings_tenant_id_mapping_status_idx"
  ON "library"."library_collection_department_mappings"("tenant_id", "mapping_status");

CREATE TABLE IF NOT EXISTS "library"."library_koha_import_batches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "import_name" TEXT NOT NULL,
  "source_system" TEXT NOT NULL DEFAULT 'KOHA',
  "uploaded_file_name" TEXT NOT NULL,
  "stored_file_path" TEXT,
  "uploaded_by_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "total_source_records" INTEGER NOT NULL DEFAULT 0,
  "total_copies" INTEGER NOT NULL DEFAULT 0,
  "valid_records" INTEGER NOT NULL DEFAULT 0,
  "imported_books" INTEGER NOT NULL DEFAULT 0,
  "imported_copies" INTEGER NOT NULL DEFAULT 0,
  "skipped_records" INTEGER NOT NULL DEFAULT 0,
  "duplicate_records" INTEGER NOT NULL DEFAULT 0,
  "failed_records" INTEGER NOT NULL DEFAULT 0,
  "error_report_path" TEXT,
  "summary" JSONB NOT NULL DEFAULT '{}',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_koha_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_koha_import_batches_tenant_id_created_at_idx"
  ON "library"."library_koha_import_batches"("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "library"."library_koha_staged_books" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "source_bibliographic_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "author" TEXT,
  "isbn_raw" TEXT,
  "isbn10" TEXT,
  "isbn13" TEXT,
  "publisher" TEXT,
  "publication_year" TEXT,
  "publication_place" TEXT,
  "edition" TEXT,
  "series" TEXT,
  "pages" TEXT,
  "classification_number" TEXT,
  "item_type_code" TEXT,
  "source_url" TEXT,
  "validation_status" TEXT NOT NULL DEFAULT 'PENDING',
  "issues" JSONB NOT NULL DEFAULT '[]',
  "book_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_koha_staged_books_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_koha_staged_books_batch_id_source_bibliographic_id_key"
  ON "library"."library_koha_staged_books"("batch_id", "source_bibliographic_id");
CREATE INDEX IF NOT EXISTS "library_koha_staged_books_batch_id_validation_status_idx"
  ON "library"."library_koha_staged_books"("batch_id", "validation_status");

CREATE TABLE IF NOT EXISTS "library"."library_koha_staged_copies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "source_item_id" TEXT NOT NULL,
  "source_bibliographic_id" TEXT NOT NULL,
  "barcode" TEXT,
  "accession_number" TEXT,
  "call_number" TEXT,
  "collection_code" TEXT,
  "home_branch_code" TEXT,
  "shelving_location" TEXT,
  "item_type_code" TEXT,
  "acquisition_date" TEXT,
  "acquisition_price" TEXT,
  "withdrawn" TEXT,
  "item_lost" TEXT,
  "damaged" TEXT,
  "not_for_loan" TEXT,
  "copy_status" TEXT,
  "validation_status" TEXT NOT NULL DEFAULT 'PENDING',
  "issues" JSONB NOT NULL DEFAULT '[]',
  "copy_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "library_koha_staged_copies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_koha_staged_copies_batch_id_source_item_id_key"
  ON "library"."library_koha_staged_copies"("batch_id", "source_item_id");
CREATE INDEX IF NOT EXISTS "library_koha_staged_copies_batch_id_source_bibliographic_id_idx"
  ON "library"."library_koha_staged_copies"("batch_id", "source_bibliographic_id");
CREATE INDEX IF NOT EXISTS "library_koha_staged_copies_batch_id_validation_status_idx"
  ON "library"."library_koha_staged_copies"("batch_id", "validation_status");
CREATE INDEX IF NOT EXISTS "library_koha_staged_copies_batch_id_collection_code_idx"
  ON "library"."library_koha_staged_copies"("batch_id", "collection_code");

DO $$ BEGIN
  ALTER TABLE "library"."library_koha_staged_books"
    ADD CONSTRAINT "library_koha_staged_books_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "library"."library_koha_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "library"."library_koha_staged_copies"
    ADD CONSTRAINT "library_koha_staged_copies_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "library"."library_koha_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
