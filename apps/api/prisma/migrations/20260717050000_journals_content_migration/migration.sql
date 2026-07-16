-- Journals content migration: SEO, downloads, media, redirects, import runs, board extras

ALTER TABLE "academic"."journal_pages"
  ADD COLUMN IF NOT EXISTS "seo_title" TEXT,
  ADD COLUMN IF NOT EXISTS "seo_description" TEXT,
  ADD COLUMN IF NOT EXISTS "seo_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "academic"."journal_editorial_members"
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "import_status" TEXT,
  ADD COLUMN IF NOT EXISTS "import_notes" TEXT;

CREATE INDEX IF NOT EXISTS "journal_editorial_members_journal_id_board_type_idx"
  ON "academic"."journal_editorial_members"("journal_id", "board_type");

CREATE TABLE IF NOT EXISTS "academic"."journal_downloads" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "volume_id" UUID,
  "issue_id" UUID,
  "file_url" TEXT NOT NULL,
  "file_name" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "import_status" TEXT,
  "import_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_downloads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_downloads_tenant_id_journal_id_is_published_idx"
  ON "academic"."journal_downloads"("tenant_id", "journal_id", "is_published");
CREATE INDEX IF NOT EXISTS "journal_downloads_journal_id_category_idx"
  ON "academic"."journal_downloads"("journal_id", "category");

CREATE TABLE IF NOT EXISTS "academic"."journal_media_assets" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'OTHER',
  "storage_key" TEXT NOT NULL,
  "public_url" TEXT NOT NULL,
  "original_url" TEXT,
  "file_name" TEXT,
  "mime_type" TEXT,
  "bytes" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_media_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_media_assets_tenant_id_journal_id_kind_idx"
  ON "academic"."journal_media_assets"("tenant_id", "journal_id", "kind");
CREATE INDEX IF NOT EXISTS "journal_media_assets_journal_id_original_url_idx"
  ON "academic"."journal_media_assets"("journal_id", "original_url");

CREATE TABLE IF NOT EXISTS "academic"."journal_redirects" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "from_path" TEXT NOT NULL,
  "to_path" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL DEFAULT 301,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_redirects_journal_id_from_path_key"
  ON "academic"."journal_redirects"("journal_id", "from_path");
CREATE INDEX IF NOT EXISTS "journal_redirects_tenant_id_journal_id_idx"
  ON "academic"."journal_redirects"("tenant_id", "journal_id");

CREATE TABLE IF NOT EXISTS "academic"."journal_import_runs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "report_json" JSONB,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_import_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_import_runs_tenant_id_journal_id_started_at_idx"
  ON "academic"."journal_import_runs"("tenant_id", "journal_id", "started_at");

DO $$ BEGIN
  ALTER TABLE "academic"."journal_downloads"
    ADD CONSTRAINT "journal_downloads_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_downloads"
    ADD CONSTRAINT "journal_downloads_volume_id_fkey"
    FOREIGN KEY ("volume_id") REFERENCES "academic"."journal_volumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_downloads"
    ADD CONSTRAINT "journal_downloads_issue_id_fkey"
    FOREIGN KEY ("issue_id") REFERENCES "academic"."journal_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_media_assets"
    ADD CONSTRAINT "journal_media_assets_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_redirects"
    ADD CONSTRAINT "journal_redirects_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_import_runs"
    ADD CONSTRAINT "journal_import_runs_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
