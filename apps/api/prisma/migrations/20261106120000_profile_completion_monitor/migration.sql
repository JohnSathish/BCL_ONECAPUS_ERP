-- Profile completion monitor settings and reminder delivery history.
CREATE TABLE IF NOT EXISTS "academic"."profile_completion_settings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "required_keys" JSONB NOT NULL,
  "reminder_interval_hours" INTEGER NOT NULL DEFAULT 24,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_completion_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "profile_completion_settings_tenant_id_key"
  ON "academic"."profile_completion_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "academic"."profile_reminder_batches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "message_template" TEXT NOT NULL,
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "sent_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_reminder_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "profile_reminder_batches_tenant_id_created_at_idx"
  ON "academic"."profile_reminder_batches"("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "academic"."profile_reminder_deliveries" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "destination" TEXT,
  "status" TEXT NOT NULL,
  "provider" TEXT,
  "provider_ref" TEXT,
  "error" TEXT,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_reminder_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "profile_reminder_deliveries_lookup_idx"
  ON "academic"."profile_reminder_deliveries"("tenant_id", "student_id", "channel", "sent_at");

CREATE INDEX IF NOT EXISTS "profile_reminder_deliveries_batch_id_idx"
  ON "academic"."profile_reminder_deliveries"("batch_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_reminder_deliveries_batch_id_fkey'
  ) THEN
    ALTER TABLE "academic"."profile_reminder_deliveries"
      ADD CONSTRAINT "profile_reminder_deliveries_batch_id_fkey"
      FOREIGN KEY ("batch_id") REFERENCES "academic"."profile_reminder_batches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
