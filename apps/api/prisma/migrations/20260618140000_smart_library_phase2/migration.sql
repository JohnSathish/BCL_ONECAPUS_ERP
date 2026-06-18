-- BCL Smart Library Phase 2 — reading analytics support fields, accession workflow

ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "accession_prefix" TEXT NOT NULL DEFAULT 'ACC',
  ADD COLUMN IF NOT EXISTS "accession_next_seq" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "library"."library_books"
  ADD COLUMN IF NOT EXISTS "accession_status" TEXT NOT NULL DEFAULT 'ON_SHELF';

CREATE INDEX IF NOT EXISTS "library_books_tenant_id_accession_status_idx"
  ON "library"."library_books"("tenant_id", "accession_status");
