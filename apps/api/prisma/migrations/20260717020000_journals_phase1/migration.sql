-- Journal Management Platform Phase 1
CREATE TABLE IF NOT EXISTS "academic"."journals" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "short_name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "subdomain" TEXT,
  "issn" TEXT,
  "logo_url" TEXT,
  "banner_url" TEXT,
  "theme_json" JSONB NOT NULL DEFAULT '{}',
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "description" TEXT,
  "publisher" TEXT,
  "institution" TEXT,
  "frequency" TEXT DEFAULT 'ANNUAL',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "default_language" TEXT NOT NULL DEFAULT 'en',
  "tagline" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "journals_tenant_id_slug_key"
  ON "academic"."journals"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "journals_tenant_id_status_idx"
  ON "academic"."journals"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."journal_pages" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body_html" TEXT,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_pages_journal_id_key_key"
  ON "academic"."journal_pages"("journal_id", "key");
CREATE INDEX IF NOT EXISTS "journal_pages_tenant_id_journal_id_idx"
  ON "academic"."journal_pages"("tenant_id", "journal_id");

CREATE TABLE IF NOT EXISTS "academic"."journal_announcements" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body_html" TEXT,
  "published_at" TIMESTAMP(3),
  "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_announcements_tenant_id_journal_id_is_published_idx"
  ON "academic"."journal_announcements"("tenant_id", "journal_id", "is_published");

CREATE TABLE IF NOT EXISTS "academic"."journal_editorial_members" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "full_name" TEXT NOT NULL,
  "role_title" TEXT NOT NULL,
  "board_type" TEXT NOT NULL DEFAULT 'BOARD',
  "photo_url" TEXT,
  "institution" TEXT,
  "email" TEXT,
  "orcid" TEXT,
  "bio" TEXT,
  "research_areas" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_editorial_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_editorial_members_tenant_id_journal_id_is_active_idx"
  ON "academic"."journal_editorial_members"("tenant_id", "journal_id", "is_active");

CREATE TABLE IF NOT EXISTS "academic"."journal_volumes" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "volume_number" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "label" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_volumes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_volumes_journal_id_volume_number_year_key"
  ON "academic"."journal_volumes"("journal_id", "volume_number", "year");
CREATE INDEX IF NOT EXISTS "journal_volumes_tenant_id_journal_id_idx"
  ON "academic"."journal_volumes"("tenant_id", "journal_id");

CREATE TABLE IF NOT EXISTS "academic"."journal_issues" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "volume_id" UUID NOT NULL,
  "issue_number" INTEGER NOT NULL,
  "title" TEXT,
  "publication_date" DATE,
  "cover_url" TEXT,
  "editorial_html" TEXT,
  "summary" TEXT,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_issues_volume_id_issue_number_key"
  ON "academic"."journal_issues"("volume_id", "issue_number");
CREATE INDEX IF NOT EXISTS "journal_issues_tenant_id_journal_id_is_current_idx"
  ON "academic"."journal_issues"("tenant_id", "journal_id", "is_current");

CREATE TABLE IF NOT EXISTS "academic"."journal_articles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "journal_id" UUID NOT NULL,
  "issue_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "abstract" TEXT,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "doi" TEXT,
  "page_range" TEXT,
  "pdf_url" TEXT,
  "html_content" TEXT,
  "category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "download_count" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMP(3),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_articles_tenant_id_journal_id_status_idx"
  ON "academic"."journal_articles"("tenant_id", "journal_id", "status");
CREATE INDEX IF NOT EXISTS "journal_articles_issue_id_idx"
  ON "academic"."journal_articles"("issue_id");

CREATE TABLE IF NOT EXISTS "academic"."journal_article_authors" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "full_name" TEXT NOT NULL,
  "affiliation" TEXT,
  "email" TEXT,
  "orcid" TEXT,
  "is_corresponding" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "journal_article_authors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_article_authors_article_id_idx"
  ON "academic"."journal_article_authors"("article_id");

DO $$ BEGIN
  ALTER TABLE "academic"."journal_pages"
    ADD CONSTRAINT "journal_pages_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_announcements"
    ADD CONSTRAINT "journal_announcements_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_editorial_members"
    ADD CONSTRAINT "journal_editorial_members_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_volumes"
    ADD CONSTRAINT "journal_volumes_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "academic"."journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_issues"
    ADD CONSTRAINT "journal_issues_volume_id_fkey"
    FOREIGN KEY ("volume_id") REFERENCES "academic"."journal_volumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_articles"
    ADD CONSTRAINT "journal_articles_issue_id_fkey"
    FOREIGN KEY ("issue_id") REFERENCES "academic"."journal_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."journal_article_authors"
    ADD CONSTRAINT "journal_article_authors_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "academic"."journal_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
