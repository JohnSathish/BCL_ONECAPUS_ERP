-- Principal Communication Hub (private Gmail client for Principal)

CREATE TABLE IF NOT EXISTS "platform"."principal_mailbox_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "google_email" TEXT NOT NULL,
  "account_label" TEXT NOT NULL DEFAULT 'PERSONAL',
  "encrypted_tokens" TEXT NOT NULL,
  "scopes" TEXT NOT NULL DEFAULT '',
  "history_id" TEXT,
  "last_synced_at" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS "principal_mailbox_accounts_tenant_owner_email_uidx"
  ON "platform"."principal_mailbox_accounts" ("tenant_id", "owner_user_id", "google_email");
CREATE INDEX IF NOT EXISTS "principal_mailbox_accounts_tenant_owner_idx"
  ON "platform"."principal_mailbox_accounts" ("tenant_id", "owner_user_id");

CREATE TABLE IF NOT EXISTS "platform"."principal_mail_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "account_id" UUID NOT NULL REFERENCES "platform"."principal_mailbox_accounts"("id") ON DELETE CASCADE,
  "gmail_message_id" TEXT NOT NULL,
  "gmail_thread_id" TEXT NOT NULL,
  "folder" TEXT NOT NULL DEFAULT 'INBOX',
  "subject" TEXT NOT NULL DEFAULT '',
  "snippet" TEXT NOT NULL DEFAULT '',
  "from_address" TEXT NOT NULL DEFAULT '',
  "from_name" TEXT,
  "to_addresses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "cc_addresses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "bcc_addresses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "body_html" TEXT,
  "body_text" TEXT,
  "label_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "starred" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "has_attachment" BOOLEAN NOT NULL DEFAULT FALSE,
  "importance" TEXT NOT NULL DEFAULT 'NORMAL',
  "category" TEXT NOT NULL DEFAULT 'Others',
  "received_at" TIMESTAMPTZ NOT NULL,
  "sent_at" TIMESTAMPTZ,
  "internal_date_ms" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS "principal_mail_messages_account_gmail_uidx"
  ON "platform"."principal_mail_messages" ("account_id", "gmail_message_id");
CREATE INDEX IF NOT EXISTS "principal_mail_messages_folder_idx"
  ON "platform"."principal_mail_messages" ("tenant_id", "account_id", "folder", "received_at");
CREATE INDEX IF NOT EXISTS "principal_mail_messages_starred_idx"
  ON "platform"."principal_mail_messages" ("tenant_id", "account_id", "starred");
CREATE INDEX IF NOT EXISTS "principal_mail_messages_read_idx"
  ON "platform"."principal_mail_messages" ("tenant_id", "account_id", "is_read");

CREATE TABLE IF NOT EXISTS "platform"."principal_mail_attachments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "message_id" UUID NOT NULL REFERENCES "platform"."principal_mail_messages"("id") ON DELETE CASCADE,
  "gmail_attachment_id" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "principal_mail_attachments_message_idx"
  ON "platform"."principal_mail_attachments" ("tenant_id", "message_id");

CREATE TABLE IF NOT EXISTS "platform"."principal_mail_drafts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "account_id" UUID NOT NULL REFERENCES "platform"."principal_mailbox_accounts"("id") ON DELETE CASCADE,
  "to_addresses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "cc_addresses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "bcc_addresses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "subject" TEXT NOT NULL DEFAULT '',
  "body_html" TEXT NOT NULL DEFAULT '',
  "body_text" TEXT,
  "reply_to_message_id" UUID,
  "scheduled_at" TIMESTAMPTZ,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "principal_mail_drafts_account_idx"
  ON "platform"."principal_mail_drafts" ("tenant_id", "account_id");

CREATE TABLE IF NOT EXISTS "platform"."principal_mail_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "account_id" UUID REFERENCES "platform"."principal_mailbox_accounts"("id") ON DELETE SET NULL,
  "actor_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "principal_mail_audit_actor_idx"
  ON "platform"."principal_mail_audit_logs" ("tenant_id", "actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "principal_mail_audit_account_idx"
  ON "platform"."principal_mail_audit_logs" ("tenant_id", "account_id", "created_at");

-- Global permission (idempotent)
INSERT INTO "platform"."permissions" ("id", "slug", "resource", "action", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'principal-comms:access', 'principal-comms', 'access',
  'Private Principal Communication Hub (mailbox) — Principal role only', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "platform"."permissions" WHERE "slug" = 'principal-comms:access'
);

-- Grant to principal role(s) across tenants
INSERT INTO "platform"."role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "platform"."roles" r
CROSS JOIN "platform"."permissions" p
WHERE r."slug" = 'principal'
  AND p."slug" = 'principal-comms:access'
  AND NOT EXISTS (
    SELECT 1 FROM "platform"."role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
