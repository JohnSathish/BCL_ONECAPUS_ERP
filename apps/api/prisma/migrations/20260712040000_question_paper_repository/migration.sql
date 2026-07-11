-- Question Paper Repository: versions, share links, enriched metadata

ALTER TABLE "academic"."question_papers"
  ADD COLUMN IF NOT EXISTS "examination_type" TEXT,
  ADD COLUMN IF NOT EXISTS "exam_cycle" TEXT,
  ADD COLUMN IF NOT EXISTS "subject_category" TEXT,
  ADD COLUMN IF NOT EXISTS "language" TEXT,
  ADD COLUMN IF NOT EXISTS "university_name" TEXT,
  ADD COLUMN IF NOT EXISTS "prepared_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "verified_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "checksum_sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "current_version_no" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "question_papers_tenant_id_examination_type_idx"
  ON "academic"."question_papers"("tenant_id", "examination_type");
CREATE INDEX IF NOT EXISTS "question_papers_tenant_id_exam_cycle_idx"
  ON "academic"."question_papers"("tenant_id", "exam_cycle");
CREATE INDEX IF NOT EXISTS "question_papers_tenant_id_language_idx"
  ON "academic"."question_papers"("tenant_id", "language");

CREATE TABLE IF NOT EXISTS "academic"."question_paper_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "paper_id" UUID NOT NULL,
  "version_no" INTEGER NOT NULL,
  "file_path" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT,
  "file_size_bytes" INTEGER,
  "checksum_sha256" TEXT,
  "uploaded_by_id" UUID,
  "change_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_paper_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "question_paper_versions_paper_id_version_no_key"
  ON "academic"."question_paper_versions"("paper_id", "version_no");
CREATE INDEX IF NOT EXISTS "question_paper_versions_tenant_id_paper_id_idx"
  ON "academic"."question_paper_versions"("tenant_id", "paper_id");

DO $$ BEGIN
  ALTER TABLE "academic"."question_paper_versions"
    ADD CONSTRAINT "question_paper_versions_paper_id_fkey"
    FOREIGN KEY ("paper_id") REFERENCES "academic"."question_papers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "academic"."question_paper_share_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "paper_id" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "created_by_id" UUID,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_paper_share_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "question_paper_share_links_token_key"
  ON "academic"."question_paper_share_links"("token");
CREATE INDEX IF NOT EXISTS "question_paper_share_links_tenant_id_paper_id_idx"
  ON "academic"."question_paper_share_links"("tenant_id", "paper_id");

DO $$ BEGIN
  ALTER TABLE "academic"."question_paper_share_links"
    ADD CONSTRAINT "question_paper_share_links_paper_id_fkey"
    FOREIGN KEY ("paper_id") REFERENCES "academic"."question_papers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill version 1 for existing papers that already have a file
INSERT INTO "academic"."question_paper_versions" (
  "id", "tenant_id", "paper_id", "version_no", "file_path", "file_name",
  "mime_type", "file_size_bytes", "uploaded_by_id", "created_at"
)
SELECT
  gen_random_uuid(),
  p."tenant_id",
  p."id",
  1,
  p."file_path",
  COALESCE(p."file_name", 'paper.pdf'),
  p."mime_type",
  p."file_size_bytes",
  p."uploaded_by_id",
  COALESCE(p."created_at", CURRENT_TIMESTAMP)
FROM "academic"."question_papers" p
WHERE p."file_path" IS NOT NULL
  AND p."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "academic"."question_paper_versions" v
    WHERE v."paper_id" = p."id" AND v."version_no" = 1
  );
