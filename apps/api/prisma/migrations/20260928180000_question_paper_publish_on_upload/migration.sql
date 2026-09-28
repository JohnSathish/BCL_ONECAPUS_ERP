-- Question papers publish immediately on upload and can be shown on the public college website.
ALTER TABLE "academic"."question_papers"
  ADD COLUMN IF NOT EXISTS "show_on_website" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "question_papers_tenant_id_status_show_on_website_idx"
  ON "academic"."question_papers" ("tenant_id", "status", "show_on_website");

-- Papers that were waiting in draft / approval (with a file) become published,
-- matching the new "publish on upload" behaviour.
UPDATE "academic"."question_paper_approvals" a
SET "status" = 'SKIPPED'
FROM "academic"."question_papers" p
WHERE a."paper_id" = p."id"
  AND a."status" = 'PENDING'
  AND p."deleted_at" IS NULL
  AND p."file_path" IS NOT NULL
  AND p."status" IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED');

UPDATE "academic"."question_papers"
SET "status" = 'PUBLISHED',
    "published_at" = COALESCE("published_at", NOW()),
    "published_by_id" = COALESCE("published_by_id", "uploaded_by_id"),
    "updated_at" = NOW()
WHERE "deleted_at" IS NULL
  AND "file_path" IS NOT NULL
  AND "status" IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED');
