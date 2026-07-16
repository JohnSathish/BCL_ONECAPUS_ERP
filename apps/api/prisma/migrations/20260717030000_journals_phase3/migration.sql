-- Journal Platform Phase 3: production, DOI, plagiarism fields

ALTER TABLE "academic"."journals"
  ADD COLUMN IF NOT EXISTS "doi_prefix" TEXT,
  ADD COLUMN IF NOT EXISTS "crossref_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "crossref_depositor_name" TEXT,
  ADD COLUMN IF NOT EXISTS "crossref_depositor_email" TEXT,
  ADD COLUMN IF NOT EXISTS "crossref_registrant" TEXT,
  ADD COLUMN IF NOT EXISTS "crossref_username" TEXT,
  ADD COLUMN IF NOT EXISTS "crossref_password_enc" TEXT,
  ADD COLUMN IF NOT EXISTS "doi_sequence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "academic"."journal_articles"
  ADD COLUMN IF NOT EXISTS "csl_json" JSONB;

ALTER TABLE "academic"."journal_submissions"
  ADD COLUMN IF NOT EXISTS "production_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "proof_approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "proof_approved_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "similarity_score" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "similarity_report_file_id" UUID;

CREATE TABLE IF NOT EXISTS "academic"."journal_doi_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "article_id" UUID,
    "submission_id" UUID,
    "doi" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "request_xml" TEXT,
    "response_body" TEXT,
    "deposited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_doi_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_doi_records_journal_id_doi_key" ON "academic"."journal_doi_records"("journal_id", "doi");
CREATE INDEX IF NOT EXISTS "journal_doi_records_tenant_id_journal_id_status_idx" ON "academic"."journal_doi_records"("tenant_id", "journal_id", "status");
CREATE INDEX IF NOT EXISTS "journal_doi_records_article_id_idx" ON "academic"."journal_doi_records"("article_id");

ALTER TABLE "academic"."journal_doi_records" DROP CONSTRAINT IF EXISTS "journal_doi_records_journal_id_fkey";
ALTER TABLE "academic"."journal_doi_records" ADD CONSTRAINT "journal_doi_records_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."journal_doi_records" DROP CONSTRAINT IF EXISTS "journal_doi_records_article_id_fkey";
ALTER TABLE "academic"."journal_doi_records" ADD CONSTRAINT "journal_doi_records_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "academic"."journal_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."journal_doi_records" DROP CONSTRAINT IF EXISTS "journal_doi_records_submission_id_fkey";
ALTER TABLE "academic"."journal_doi_records" ADD CONSTRAINT "journal_doi_records_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "academic"."journal_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
