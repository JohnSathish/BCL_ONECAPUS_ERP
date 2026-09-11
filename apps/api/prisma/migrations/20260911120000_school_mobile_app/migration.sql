-- St. Luke's dedicated school mobile app (schema school)

CREATE TABLE IF NOT EXISTS "school"."school_mobile_settings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "android_latest_version" TEXT NOT NULL DEFAULT '1.0.0',
  "ios_latest_version" TEXT NOT NULL DEFAULT '1.0.0',
  "min_version" TEXT NOT NULL DEFAULT '1.0.0',
  "force_update" BOOLEAN NOT NULL DEFAULT false,
  "android_store_url" TEXT,
  "ios_store_url" TEXT,
  "release_notes" TEXT,
  "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
  "maintenance_message" TEXT,
  "extras_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_mobile_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_mobile_settings_tenant_id_key"
  ON "school"."school_mobile_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "school"."school_mobile_devices" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "device_id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "persona" TEXT NOT NULL,
  "app_version" TEXT,
  "push_token" TEXT,
  "device_label" TEXT,
  "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_mobile_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_mobile_devices_tenant_id_device_id_key"
  ON "school"."school_mobile_devices"("tenant_id", "device_id");
CREATE INDEX IF NOT EXISTS "school_mobile_devices_tenant_id_user_id_idx"
  ON "school"."school_mobile_devices"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "school_mobile_devices_tenant_id_persona_revoked_at_idx"
  ON "school"."school_mobile_devices"("tenant_id", "persona", "revoked_at");

CREATE TABLE IF NOT EXISTS "school"."school_mobile_inbox" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "image_url" TEXT,
  "type" TEXT NOT NULL,
  "deep_link" TEXT,
  "related_id" TEXT,
  "audience" TEXT NOT NULL DEFAULT 'user',
  "read_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_mobile_inbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_mobile_inbox_tenant_id_user_id_created_at_idx"
  ON "school"."school_mobile_inbox"("tenant_id", "user_id", "created_at");
CREATE INDEX IF NOT EXISTS "school_mobile_inbox_tenant_id_user_id_read_at_idx"
  ON "school"."school_mobile_inbox"("tenant_id", "user_id", "read_at");

CREATE TABLE IF NOT EXISTS "school"."school_mobile_prayers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "weekday" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_mobile_prayers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_mobile_prayers_tenant_id_weekday_key"
  ON "school"."school_mobile_prayers"("tenant_id", "weekday");

CREATE TABLE IF NOT EXISTS "school"."school_mobile_broadcasts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "image_url" TEXT,
  "type" TEXT NOT NULL,
  "deep_link" TEXT,
  "audience" TEXT NOT NULL,
  "audience_filter" JSONB NOT NULL DEFAULT '{}',
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_mobile_broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_mobile_broadcasts_tenant_id_created_at_idx"
  ON "school"."school_mobile_broadcasts"("tenant_id", "created_at");
