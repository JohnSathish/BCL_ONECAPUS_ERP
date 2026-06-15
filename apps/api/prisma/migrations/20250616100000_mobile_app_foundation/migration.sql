-- Mobile App Foundation Phase 1

ALTER TABLE "platform"."refresh_sessions"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "platform"."mobile_app_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_app_name" TEXT NOT NULL DEFAULT 'Student App',
  "staff_app_name" TEXT NOT NULL DEFAULT 'Staff App',
  "student_min_version" TEXT NOT NULL DEFAULT '1.0.0',
  "student_latest_version" TEXT NOT NULL DEFAULT '1.0.0',
  "staff_min_version" TEXT NOT NULL DEFAULT '1.0.0',
  "staff_latest_version" TEXT NOT NULL DEFAULT '1.0.0',
  "student_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
  "staff_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
  "maintenance_message" TEXT,
  "student_force_update" BOOLEAN NOT NULL DEFAULT false,
  "staff_force_update" BOOLEAN NOT NULL DEFAULT false,
  "force_update_message" TEXT,
  "student_dashboard_config" JSONB NOT NULL DEFAULT '{}',
  "staff_dashboard_config" JSONB NOT NULL DEFAULT '{}',
  "branding_overrides" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_app_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_app_settings_tenant_id_key" UNIQUE ("tenant_id"),
  CONSTRAINT "mobile_app_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "platform"."mobile_app_releases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "app_type" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "release_notes" TEXT,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_app_releases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_app_releases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "mobile_app_releases_tenant_id_app_type_idx" ON "platform"."mobile_app_releases"("tenant_id", "app_type");

CREATE TABLE IF NOT EXISTS "platform"."mobile_devices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "app_type" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "push_token" TEXT,
  "app_version" TEXT,
  "os_version" TEXT,
  "device_model" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_devices_tenant_id_device_id_key" UNIQUE ("tenant_id", "device_id"),
  CONSTRAINT "mobile_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mobile_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "mobile_devices_tenant_id_user_id_idx" ON "platform"."mobile_devices"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "mobile_devices_tenant_id_status_idx" ON "platform"."mobile_devices"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "platform"."mobile_app_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID,
  "app_type" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "app_version" TEXT,
  "device_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_app_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_app_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "mobile_app_events_tenant_id_occurred_at_idx" ON "platform"."mobile_app_events"("tenant_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "mobile_app_events_tenant_id_app_type_event_type_idx" ON "platform"."mobile_app_events"("tenant_id", "app_type", "event_type");

CREATE TABLE IF NOT EXISTS "platform"."mobile_app_daily_stats" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "app_type" TEXT NOT NULL,
  "active_users" INTEGER NOT NULL DEFAULT 0,
  "login_count" INTEGER NOT NULL DEFAULT 0,
  "version_breakdown" JSONB NOT NULL DEFAULT '{}',
  "push_sent" INTEGER NOT NULL DEFAULT 0,
  "push_delivered" INTEGER NOT NULL DEFAULT 0,
  "push_failed" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_app_daily_stats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_app_daily_stats_tenant_id_date_app_type_key" UNIQUE ("tenant_id", "date", "app_type"),
  CONSTRAINT "mobile_app_daily_stats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "platform"."permissions" ("id", "slug", "resource", "action", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'mobile:settings:read', 'mobile', 'settings:read', 'View mobile app control settings', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "platform"."permissions" WHERE "slug" = 'mobile:settings:read');

INSERT INTO "platform"."permissions" ("id", "slug", "resource", "action", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'mobile:settings:manage', 'mobile', 'settings:manage', 'Manage mobile app control settings', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "platform"."permissions" WHERE "slug" = 'mobile:settings:manage');
