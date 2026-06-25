-- Official Documents module

CREATE TABLE "core"."official_document_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "default_prefix" TEXT NOT NULL DEFAULT 'DBC',
    "reference_pattern" TEXT NOT NULL DEFAULT '{PREFIX}/{TYPE}/{YEAR}/{SEQ:4}',
    "verify_base_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_document_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_document_settings_tenant_id_key" ON "core"."official_document_settings"("tenant_id");

CREATE TABLE "core"."official_letterheads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "college_name" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "contact_line" TEXT,
    "logo_path" TEXT,
    "footer_html" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_letterheads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_letterheads_tenant_id_code_key" ON "core"."official_letterheads"("tenant_id", "code");
CREATE INDEX "official_letterheads_tenant_id_active_idx" ON "core"."official_letterheads"("tenant_id", "active");

CREATE TABLE "core"."official_document_issuers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "signature_path" TEXT,
    "seal_path" TEXT,
    "letterhead_id" UUID,
    "ref_prefix" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_document_issuers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_document_issuers_tenant_id_role_code_key" ON "core"."official_document_issuers"("tenant_id", "role_code");
CREATE INDEX "official_document_issuers_tenant_id_active_idx" ON "core"."official_document_issuers"("tenant_id", "active");

ALTER TABLE "core"."official_document_issuers" ADD CONSTRAINT "official_document_issuers_letterhead_id_fkey" FOREIGN KEY ("letterhead_id") REFERENCES "core"."official_letterheads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "core"."official_document_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "subject" TEXT,
    "salutation" TEXT,
    "body_html" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_document_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "official_document_templates_tenant_id_document_type_active_idx" ON "core"."official_document_templates"("tenant_id", "document_type", "active");

CREATE TABLE "core"."official_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "reference_no" TEXT,
    "verify_token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "salutation" TEXT,
    "body_html" TEXT NOT NULL,
    "audience" JSONB NOT NULL DEFAULT '{}',
    "print_settings" JSONB NOT NULL DEFAULT '{}',
    "issuer_id" UUID,
    "letterhead_id" UUID,
    "effective_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "printed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "pdf_path" TEXT,
    "rendered_html" TEXT,
    "print_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "rejection_note" TEXT,
    "created_by_id" UUID,
    "modified_by_id" UUID,
    "approved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_documents_verify_token_key" ON "core"."official_documents"("verify_token");
CREATE INDEX "official_documents_tenant_id_status_idx" ON "core"."official_documents"("tenant_id", "status");
CREATE INDEX "official_documents_tenant_id_document_type_idx" ON "core"."official_documents"("tenant_id", "document_type");
CREATE INDEX "official_documents_tenant_id_reference_no_idx" ON "core"."official_documents"("tenant_id", "reference_no");
CREATE INDEX "official_documents_tenant_id_published_at_idx" ON "core"."official_documents"("tenant_id", "published_at");
CREATE INDEX "official_documents_tenant_id_created_at_idx" ON "core"."official_documents"("tenant_id", "created_at");

ALTER TABLE "core"."official_documents" ADD CONSTRAINT "official_documents_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "core"."official_document_issuers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core"."official_documents" ADD CONSTRAINT "official_documents_letterhead_id_fkey" FOREIGN KEY ("letterhead_id") REFERENCES "core"."official_letterheads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "core"."official_document_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "salutation" TEXT,
    "body_html" TEXT NOT NULL,
    "audience" JSONB NOT NULL DEFAULT '{}',
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_document_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_document_versions_document_id_version_no_key" ON "core"."official_document_versions"("document_id", "version_no");
CREATE INDEX "official_document_versions_tenant_id_document_id_idx" ON "core"."official_document_versions"("tenant_id", "document_id");

ALTER TABLE "core"."official_document_versions" ADD CONSTRAINT "official_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "core"."official_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "core"."official_document_approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_document_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "official_document_approvals_tenant_id_document_id_idx" ON "core"."official_document_approvals"("tenant_id", "document_id");

ALTER TABLE "core"."official_document_approvals" ADD CONSTRAINT "official_document_approvals_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "core"."official_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "core"."official_document_attachments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_document_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "official_document_attachments_tenant_id_document_id_idx" ON "core"."official_document_attachments"("tenant_id", "document_id");

ALTER TABLE "core"."official_document_attachments" ADD CONSTRAINT "official_document_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "core"."official_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "core"."official_document_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_document_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "official_document_audit_logs_tenant_id_document_id_created_at_idx" ON "core"."official_document_audit_logs"("tenant_id", "document_id", "created_at");

ALTER TABLE "core"."official_document_audit_logs" ADD CONSTRAINT "official_document_audit_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "core"."official_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "core"."official_document_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_document_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "official_document_sequences_tenant_id_document_type_year_key" ON "core"."official_document_sequences"("tenant_id", "document_type", "year");
