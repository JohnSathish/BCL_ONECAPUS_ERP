-- Support Centre foundation: extend tickets + chat/FAQ/departments/agents/routing/settings

ALTER TABLE "platform"."support_tickets"
  ADD COLUMN IF NOT EXISTS "department_id" UUID,
  ADD COLUMN IF NOT EXISTS "satisfaction_score" INTEGER,
  ADD COLUMN IF NOT EXISTS "satisfaction_note" TEXT,
  ADD COLUMN IF NOT EXISTS "attachment_url" TEXT;

ALTER TABLE "platform"."support_ticket_comments"
  ADD COLUMN IF NOT EXISTS "attachment_url" TEXT;

CREATE TABLE IF NOT EXISTS "platform"."support_ticket_sequences" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "current_no" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_ticket_sequences_tenant_id_year_key"
  ON "platform"."support_ticket_sequences"("tenant_id", "year");

CREATE TABLE IF NOT EXISTS "platform"."support_departments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_departments_tenant_id_code_key"
  ON "platform"."support_departments"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "support_departments_tenant_id_is_active_idx"
  ON "platform"."support_departments"("tenant_id", "is_active");

CREATE TABLE IF NOT EXISTS "platform"."support_agents" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "department_id" UUID,
  "display_name" TEXT,
  "is_online" BOOLEAN NOT NULL DEFAULT false,
  "last_seen_at" TIMESTAMP(3),
  "max_concurrent" INTEGER NOT NULL DEFAULT 5,
  "preferred_lang" TEXT NOT NULL DEFAULT 'en',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_agents_tenant_id_user_id_key"
  ON "platform"."support_agents"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "support_agents_tenant_id_department_id_idx"
  ON "platform"."support_agents"("tenant_id", "department_id");

CREATE TABLE IF NOT EXISTS "platform"."support_chat_threads" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_user_id" UUID NOT NULL,
  "department_id" UUID,
  "agent_id" UUID,
  "ticket_id" UUID,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "subject" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "student_lang" TEXT NOT NULL DEFAULT 'en',
  "last_message_at" TIMESTAMP(3),
  "last_message_preview" VARCHAR(500),
  "unread_student" INTEGER NOT NULL DEFAULT 0,
  "unread_agent" INTEGER NOT NULL DEFAULT 0,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_chat_threads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_chat_threads_ticket_id_key"
  ON "platform"."support_chat_threads"("ticket_id");
CREATE INDEX IF NOT EXISTS "support_chat_threads_tenant_id_status_idx"
  ON "platform"."support_chat_threads"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "support_chat_threads_tenant_id_student_user_id_idx"
  ON "platform"."support_chat_threads"("tenant_id", "student_user_id");
CREATE INDEX IF NOT EXISTS "support_chat_threads_tenant_id_department_id_idx"
  ON "platform"."support_chat_threads"("tenant_id", "department_id");

CREATE TABLE IF NOT EXISTS "platform"."support_chat_messages" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "thread_id" UUID NOT NULL,
  "sender_user_id" UUID NOT NULL,
  "sender_role" TEXT NOT NULL DEFAULT 'STUDENT',
  "body_original" TEXT NOT NULL,
  "body_translated" TEXT,
  "lang_detected" TEXT,
  "lang_target" TEXT,
  "delivery_status" TEXT NOT NULL DEFAULT 'SENT',
  "delivered_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "reply_to_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_chat_messages_tenant_id_thread_id_created_at_idx"
  ON "platform"."support_chat_messages"("tenant_id", "thread_id", "created_at");

CREATE TABLE IF NOT EXISTS "platform"."support_chat_attachments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_url" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_chat_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_chat_attachments_tenant_id_message_id_idx"
  ON "platform"."support_chat_attachments"("tenant_id", "message_id");

CREATE TABLE IF NOT EXISTS "platform"."support_faq_categories" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_faq_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_faq_categories_tenant_id_code_key"
  ON "platform"."support_faq_categories"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "platform"."support_faq_articles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_faq_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_faq_articles_tenant_id_is_published_idx"
  ON "platform"."support_faq_articles"("tenant_id", "is_published");
CREATE INDEX IF NOT EXISTS "support_faq_articles_tenant_id_category_id_idx"
  ON "platform"."support_faq_articles"("tenant_id", "category_id");

CREATE TABLE IF NOT EXISTS "platform"."support_routing_rules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "department_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_routing_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_routing_rules_tenant_id_category_key"
  ON "platform"."support_routing_rules"("tenant_id", "category");

CREATE TABLE IF NOT EXISTS "platform"."support_settings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "max_upload_mb" INTEGER NOT NULL DEFAULT 10,
  "allowed_mime_json" JSONB NOT NULL DEFAULT '["image/jpeg","image/png","application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/zip"]',
  "default_agent_lang" TEXT NOT NULL DEFAULT 'en',
  "translation_enabled" BOOLEAN NOT NULL DEFAULT true,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "support_hours" TEXT,
  "welcome_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_settings_tenant_id_key"
  ON "platform"."support_settings"("tenant_id");

CREATE INDEX IF NOT EXISTS "support_tickets_tenant_id_department_id_idx"
  ON "platform"."support_tickets"("tenant_id", "department_id");
CREATE INDEX IF NOT EXISTS "support_ticket_comments_tenant_id_ticket_id_idx"
  ON "platform"."support_ticket_comments"("tenant_id", "ticket_id");

-- FKs (idempotent-ish via DO blocks)
DO $$ BEGIN
  ALTER TABLE "platform"."support_tickets"
    ADD CONSTRAINT "support_tickets_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "platform"."support_departments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform"."support_agents"
    ADD CONSTRAINT "support_agents_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "platform"."support_departments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform"."support_chat_threads"
    ADD CONSTRAINT "support_chat_threads_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "platform"."support_departments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform"."support_chat_threads"
    ADD CONSTRAINT "support_chat_threads_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "platform"."support_agents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform"."support_chat_threads"
    ADD CONSTRAINT "support_chat_threads_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "platform"."support_tickets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform"."support_chat_messages"
    ADD CONSTRAINT "support_chat_messages_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "platform"."support_chat_threads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform"."support_chat_attachments"
    ADD CONSTRAINT "support_chat_attachments_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "platform"."support_chat_messages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform"."support_faq_articles"
    ADD CONSTRAINT "support_faq_articles_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "platform"."support_faq_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "platform"."support_routing_rules"
    ADD CONSTRAINT "support_routing_rules_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "platform"."support_departments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
