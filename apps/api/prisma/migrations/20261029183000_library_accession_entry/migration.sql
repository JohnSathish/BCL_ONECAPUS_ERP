ALTER TABLE "library"."library_books"
  ADD COLUMN IF NOT EXISTS "book_type" TEXT,
  ADD COLUMN IF NOT EXISTS "subject_classification" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisition_type" TEXT,
  ADD COLUMN IF NOT EXISTS "supplier_name" TEXT,
  ADD COLUMN IF NOT EXISTS "invoice_number" TEXT,
  ADD COLUMN IF NOT EXISTS "purchase_date" DATE,
  ADD COLUMN IF NOT EXISTS "funding_source" TEXT;

ALTER TABLE "library"."library_book_copies"
  ADD COLUMN IF NOT EXISTS "copy_condition" TEXT;
