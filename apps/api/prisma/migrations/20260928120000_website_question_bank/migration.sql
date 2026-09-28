-- Website CMS: Question Bank & Previous Question Papers (college public website)
CREATE TABLE IF NOT EXISTS "academic"."website_question_bank_masters" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "code" TEXT,
  "parent_id" UUID,
  "sort_order" INT NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "website_question_bank_masters_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_question_bank_masters_site_id_kind_label_key"
  ON "academic"."website_question_bank_masters" ("site_id", "kind", "label");

CREATE INDEX IF NOT EXISTS "website_question_bank_masters_tenant_site_kind_idx"
  ON "academic"."website_question_bank_masters" ("tenant_id", "site_id", "kind", "is_active", "sort_order");

CREATE TABLE IF NOT EXISTS "academic"."website_question_papers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "academic_year_id" UUID,
  "semester" INT,
  "programme_id" UUID,
  "department_id" UUID,
  "major_id" UUID,
  "subject_id" UUID,
  "subject_name" TEXT NOT NULL DEFAULT '',
  "subject_code" TEXT NOT NULL DEFAULT '',
  "exam_type_id" UUID,
  "exam_year" INT,
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMPTZ,
  "file_storage_key" TEXT,
  "file_name" TEXT,
  "file_mime_type" TEXT,
  "file_bytes" INT,
  "file_sha256" TEXT,
  "file_version" INT NOT NULL DEFAULT 0,
  "file_updated_at" TIMESTAMPTZ,
  "download_count" INT NOT NULL DEFAULT 0,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "website_question_papers_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_question_papers_site_id_slug_key"
  ON "academic"."website_question_papers" ("site_id", "slug");

CREATE INDEX IF NOT EXISTS "website_question_papers_tenant_site_status_published_idx"
  ON "academic"."website_question_papers" ("tenant_id", "site_id", "status", "published_at");

CREATE INDEX IF NOT EXISTS "website_question_papers_site_status_year_sem_idx"
  ON "academic"."website_question_papers" ("site_id", "status", "academic_year_id", "semester");

CREATE INDEX IF NOT EXISTS "website_question_papers_site_status_prog_dept_idx"
  ON "academic"."website_question_papers" ("site_id", "status", "programme_id", "department_id");

CREATE INDEX IF NOT EXISTS "website_question_papers_site_status_code_idx"
  ON "academic"."website_question_papers" ("site_id", "status", "subject_code");

-- Header menu: Academics → Question Bank (college sites only; idempotent).
INSERT INTO "academic"."website_menu_items"
  ("id", "tenant_id", "menu_id", "label", "url", "target", "link_type", "position", "parent_id", "is_visible", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  parent."tenant_id",
  parent."menu_id",
  'Question Bank & Previous Question Papers',
  '/academics/question-bank',
  '_self',
  'CUSTOM',
  COALESCE(
    (SELECT MAX(child."position") + 1
       FROM "academic"."website_menu_items" child
      WHERE child."parent_id" = parent."id"),
    0
  ),
  parent."id",
  TRUE,
  NOW(),
  NOW()
FROM "academic"."website_menu_items" parent
JOIN "academic"."website_menus" menu ON menu."id" = parent."menu_id" AND menu."location" = 'HEADER'
JOIN "platform"."tenants" tenant ON tenant."id" = parent."tenant_id"
WHERE parent."parent_id" IS NULL
  AND LOWER(TRIM(parent."label")) = 'academics'
  AND tenant."slug" NOT IN ('tura-public-school', 'st-lukes-tura')
  AND NOT EXISTS (
    SELECT 1
      FROM "academic"."website_menu_items" existing
     WHERE existing."menu_id" = parent."menu_id"
       AND existing."url" = '/academics/question-bank'
  );
