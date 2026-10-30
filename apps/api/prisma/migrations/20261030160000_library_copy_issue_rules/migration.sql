ALTER TABLE "library"."library_book_copies"
  ADD COLUMN IF NOT EXISTS "copy_type" TEXT,
  ADD COLUMN IF NOT EXISTS "issue_allowed" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "copy_remarks" TEXT;

CREATE INDEX IF NOT EXISTS "library_book_copies_tenant_id_copy_type_idx"
  ON "library"."library_book_copies" ("tenant_id", "copy_type");
