-- Smart Library Phase 2 — Digital Library + Research Repository

ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "max_upload_mb" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "allowed_mime_types" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "student_digital_access_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "library"."library_digital_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "description" TEXT,
    "asset_type" TEXT NOT NULL,
    "category_id" UUID,
    "department_id" UUID,
    "isbn" TEXT,
    "doi" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "search_text" TEXT,
    "file_path" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "external_url" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'UPLOAD',
    "source_id" UUID,
    "visibility" TEXT NOT NULL DEFAULT 'STUDENT',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "uploaded_by_id" UUID,
    "published_by_id" UUID,
    "published_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "library_digital_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_digital_assets_tenant_id_status_idx" ON "library"."library_digital_assets"("tenant_id", "status");
CREATE INDEX "library_digital_assets_tenant_id_asset_type_idx" ON "library"."library_digital_assets"("tenant_id", "asset_type");
CREATE INDEX "library_digital_assets_tenant_id_category_id_idx" ON "library"."library_digital_assets"("tenant_id", "category_id");
CREATE INDEX "library_digital_assets_tenant_id_department_id_idx" ON "library"."library_digital_assets"("tenant_id", "department_id");
CREATE INDEX "library_digital_assets_tenant_id_source_type_source_id_idx" ON "library"."library_digital_assets"("tenant_id", "source_type", "source_id");

ALTER TABLE "library"."library_digital_assets" ADD CONSTRAINT "library_digital_assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "library"."library_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "library"."library_digital_access_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_digital_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_digital_access_logs_tenant_id_asset_id_action_idx" ON "library"."library_digital_access_logs"("tenant_id", "asset_id", "action");
CREATE INDEX "library_digital_access_logs_tenant_id_created_at_idx" ON "library"."library_digital_access_logs"("tenant_id", "created_at");

ALTER TABLE "library"."library_digital_access_logs" ADD CONSTRAINT "library_digital_access_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "library"."library_digital_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "library"."research_repository_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "item_type" TEXT NOT NULL,
    "department_id" UUID,
    "publication_year" INTEGER,
    "journal_name" TEXT,
    "doi" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "search_text" TEXT,
    "authors_json" JSONB NOT NULL DEFAULT '[]',
    "file_path" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "external_url" TEXT,
    "staff_author_id" UUID,
    "student_author_id" UUID,
    "supervisor_staff_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submitted_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "embargo_until" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "research_repository_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_repository_items_tenant_id_status_idx" ON "library"."research_repository_items"("tenant_id", "status");
CREATE INDEX "research_repository_items_tenant_id_item_type_idx" ON "library"."research_repository_items"("tenant_id", "item_type");
CREATE INDEX "research_repository_items_tenant_id_department_id_idx" ON "library"."research_repository_items"("tenant_id", "department_id");
CREATE INDEX "research_repository_items_tenant_id_staff_author_id_idx" ON "library"."research_repository_items"("tenant_id", "staff_author_id");
CREATE INDEX "research_repository_items_tenant_id_student_author_id_idx" ON "library"."research_repository_items"("tenant_id", "student_author_id");

CREATE TABLE "library"."research_repository_access_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_repository_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_repository_access_logs_tenant_id_item_id_action_idx" ON "library"."research_repository_access_logs"("tenant_id", "item_id", "action");
CREATE INDEX "research_repository_access_logs_tenant_id_created_at_idx" ON "library"."research_repository_access_logs"("tenant_id", "created_at");

ALTER TABLE "library"."research_repository_access_logs" ADD CONSTRAINT "research_repository_access_logs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library"."research_repository_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
